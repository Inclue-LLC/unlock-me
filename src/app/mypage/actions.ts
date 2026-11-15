"use server";
import { z } from "zod";
import { act, str } from "@/lib/action";
import { addAddress, ensureCustomer, parseAddress, savePaymentMethod } from "@/lib/account";
import { audit } from "@/lib/audit";
import { destroyAllSessions, destroySession, hashPassword, issueEmailToken, requireUser, safeNext, validatePassword, verifyPassword } from "@/lib/auth";
import { one, query, tx } from "@/lib/db";
import { kickDelivery, notify } from "@/lib/mail";
import { cancelOrderByUser } from "@/lib/orders";
import { getPaymentProvider, paymentProviderName } from "@/lib/payments";
import { mockSaveCard } from "@/lib/payments/mock";
import { createSetupIntent, retrieveSetupCard } from "@/lib/payments/stripe";
import { rateLimit } from "@/lib/ratelimit";
import { chargeOrder } from "@/lib/settlement";
import { appUrl, UserError } from "@/lib/util";

const actor = (id: number) => ({ id, label: `user:${id}` });

// ───────── プロフィール ─────────
export async function updateProfileAction(fd: FormData) {
  const user = await requireUser();
  await act("/mypage/profile", async () => {
    const name = z.string().trim().min(1, "お名前を入力してください").max(60).parse(str(fd, "name"));
    await query("UPDATE users SET name=$2, updated_at=now() WHERE id=$1", [user.id, name]);
  }, "プロフィールを更新しました");
}

export async function changeEmailAction(fd: FormData) {
  const user = await requireUser();
  await act("/mypage/profile", async () => {
    await rateLimit(`email-change:${user.id}`, 5, 3600);
    const email = z.string().trim().toLowerCase().email("メールアドレスの形式が正しくありません").parse(str(fd, "email"));
    const row = await one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id=$1", [user.id]);
    if (!(await verifyPassword(String(fd.get("password") ?? ""), row!.password_hash))) throw new UserError("パスワードが正しくありません");
    await tx(async (c) => {
      const exists = await one("SELECT 1 FROM users WHERE lower(email)=$1 AND id<>$2 AND status<>'withdrawn'", [email, user.id], c);
      if (exists) throw new UserError("このメールアドレスは既に使用されています");
      await query("UPDATE users SET email=$2, email_verified_at=NULL, updated_at=now() WHERE id=$1", [user.id, email], c);
      const token = await issueEmailToken(user.id, "verify", c);
      await notify({ eventKey: `verify:${user.id}:${Date.now()}`, userId: user.id, to: email, template: "verify_email", vars: { name: user.name, url: appUrl(`/verify?token=${token}`) } }, c);
      await audit(actor(user.id), "user.email_change", "user", user.id, { from: user.email, to: email }, c);
    });
    kickDelivery();
  }, "メールアドレスを変更しました。確認メールのURLから認証を完了してください。");
}

export async function changePasswordAction(fd: FormData) {
  const user = await requireUser();
  await act("/mypage/profile", async () => {
    const row = await one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id=$1", [user.id]);
    if (!(await verifyPassword(String(fd.get("current") ?? ""), row!.password_hash))) throw new UserError("現在のパスワードが正しくありません");
    const pw = String(fd.get("password") ?? "");
    validatePassword(pw);
    await query("UPDATE users SET password_hash=$2, updated_at=now() WHERE id=$1", [user.id, await hashPassword(pw)]);
    await audit(actor(user.id), "user.password_change", "user", user.id);
  }, "パスワードを変更しました");
}

// ───────── 配送先 ─────────
export async function addAddressAction(fd: FormData) {
  const user = await requireUser();
  const next = safeNext(str(fd, "next"), "/mypage/addresses");
  await act("/mypage/addresses", async () => {
    await addAddress(user.id, parseAddress(fd));
    return next;
  }, "配送先を登録しました");
}

export async function deleteAddressAction(fd: FormData) {
  const user = await requireUser();
  await act("/mypage/addresses", async () => {
    await query("UPDATE addresses SET deleted_at=now(), is_default=false WHERE id=$1 AND user_id=$2", [Number(str(fd, "id")), user.id]);
  }, "配送先を削除しました");
}

export async function defaultAddressAction(fd: FormData) {
  const user = await requireUser();
  await act("/mypage/addresses", async () => {
    await tx(async (c) => {
      await query("UPDATE addresses SET is_default=false WHERE user_id=$1", [user.id], c);
      await query("UPDATE addresses SET is_default=true WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL", [Number(str(fd, "id")), user.id], c);
    });
  });
}

// ───────── お支払い方法 ─────────
export async function addMockCardAction(fd: FormData) {
  const user = await requireUser();
  const next = safeNext(str(fd, "next"), "/mypage/payment-methods");
  await act("/mypage/payment-methods", async () => {
    if (paymentProviderName() !== "mock") throw new UserError("テストカードは利用できません");
    await ensureCustomer(user);
    await savePaymentMethod(user.id, mockSaveCard(str(fd, "kind") === "decline" ? "decline" : "ok"));
    return next;
  }, "お支払い方法を登録しました");
}

/** Stripe: カード登録用の SetupIntent を発行 */
export async function createSetupIntentAction(): Promise<{ clientSecret: string }> {
  const user = await requireUser();
  await rateLimit(`setup-intent:${user.id}`, 20, 3600);
  const customerId = await ensureCustomer(user);
  return { clientSecret: await createSetupIntent(customerId) };
}

/** Stripe: 確定済み SetupIntent をサーバー側で検証して保存 */
export async function saveStripeCardAction(setupIntentId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  try {
    const customerId = await ensureCustomer(user);
    const card = await retrieveSetupCard(setupIntentId, customerId);
    await savePaymentMethod(user.id, card);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "登録に失敗しました" };
  }
}

export async function deletePaymentMethodAction(fd: FormData) {
  const user = await requireUser();
  await act("/mypage/payment-methods", async () => {
    const id = Number(str(fd, "id"));
    const inUse = await one(
      "SELECT 1 FROM orders WHERE payment_method_id=$1 AND user_id=$2 AND status IN ('applied','awaiting_payment','payment_failed')",
      [id, user.id],
    );
    if (inUse) throw new UserError("申込中の注文で使用しているため削除できません。先に注文のお支払い方法を変更してください。");
    const pm = await one("UPDATE payment_methods SET deleted_at=now(), is_default=false WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL RETURNING provider, provider_ref", [id, user.id]);
    if (pm) await getPaymentProvider(pm.provider).detach(pm.provider_ref);
  }, "お支払い方法を削除しました");
}

export async function defaultPaymentMethodAction(fd: FormData) {
  const user = await requireUser();
  await act("/mypage/payment-methods", async () => {
    await tx(async (c) => {
      await query("UPDATE payment_methods SET is_default=false WHERE user_id=$1", [user.id], c);
      await query("UPDATE payment_methods SET is_default=true WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL", [Number(str(fd, "id")), user.id], c);
    });
  });
}

// ───────── 注文 ─────────
export async function cancelOrderAction(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, "id"));
  await act(`/mypage/orders/${id}`, async () => {
    await cancelOrderByUser(user.id, id);
    kickDelivery();
  }, "申込をキャンセルしました");
}

/** 申込中の注文のお支払い方法変更 */
export async function changeOrderPaymentMethodAction(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, "id"));
  await act(`/mypage/orders/${id}`, async () => {
    const pm = await one("SELECT id FROM payment_methods WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL", [Number(str(fd, "pm")), user.id]);
    if (!pm) throw new UserError("お支払い方法を選択してください");
    const r = await query("UPDATE orders SET payment_method_id=$3, updated_at=now() WHERE id=$1 AND user_id=$2 AND status='applied' RETURNING id", [id, user.id, pm.id]);
    if (!r.length) throw new UserError("この注文のお支払い方法は変更できません");
  }, "お支払い方法を変更しました");
}

/** 決済失敗時の再決済 */
export async function retryPaymentAction(fd: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(str(fd, "id"));
  await act(`/mypage/orders/${id}`, async () => {
    await rateLimit(`retry:${id}`, 10, 3600);
    const res = await chargeOrder(id, { offSession: false, paymentMethodId: Number(str(fd, "pm")), userId: user.id });
    if (res.status === "failed") throw new UserError(`決済できませんでした：${res.message ?? ""}`);
    if (res.status === "requires_action") return `/mypage/orders/${id}?confirm_payment=${encodeURIComponent(res.clientSecret)}`;
    if (res.status === "skipped") throw new UserError("この注文は再決済の対象ではありません");
  }, "決済が完了しました");
}

/** 配送先変更（発送準備開始まで） */
export async function changeOrderAddressAction(fd: FormData) {
  const user = await requireUser();
  const id = Number(str(fd, "id"));
  await act(`/mypage/orders/${id}`, async () => {
    const addr = await one(
      "SELECT id, name, postal_code, prefecture, city, line1, line2, phone FROM addresses WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL",
      [Number(str(fd, "address")), user.id],
    );
    if (!addr) throw new UserError("配送先を選択してください");
    const { id: addrId, ...snap } = addr;
    const r = await query(
      `UPDATE orders SET shipping_address=$3, address_id=$4, updated_at=now()
        WHERE id=$1 AND user_id=$2 AND status IN ('applied','awaiting_payment','payment_failed','paid')
          AND fulfillment_status IN ('none','manufacturing') RETURNING id`,
      [id, user.id, JSON.stringify(snap), addrId],
    );
    if (!r.length) throw new UserError("発送準備に入っているため配送先を変更できません。お問い合わせください。");
    await audit(actor(user.id), "order.address_change", "order", id, { address: snap });
  }, "配送先を変更しました");
}

// ───────── 通知・退会 ─────────
export async function updateNotifyAction(fd: FormData) {
  const user = await requireUser();
  await act("/mypage/settings", async () => {
    await query("UPDATE users SET notify_progress=$2, notify_marketing=$3, updated_at=now() WHERE id=$1", [
      user.id, fd.get("notify_progress") === "on", fd.get("notify_marketing") === "on",
    ]);
  }, "通知設定を保存しました");
}

export async function withdrawAction(fd: FormData) {
  const user = await requireUser();
  await act("/mypage/settings", async () => {
    const row = await one<{ password_hash: string }>("SELECT password_hash FROM users WHERE id=$1", [user.id]);
    if (!(await verifyPassword(String(fd.get("password") ?? ""), row!.password_hash))) throw new UserError("パスワードが正しくありません");
    const active = await one(
      `SELECT 1 FROM orders WHERE user_id=$1 AND (status IN ('applied','awaiting_payment','payment_failed')
         OR (status='paid' AND fulfillment_status NOT IN ('shipped','delivered')))`,
      [user.id],
    );
    if (active) throw new UserError("進行中の申込・未発送の注文があるため退会できません。発送完了後、または申込キャンセル後にお手続きください。");
    const pms = await query("SELECT provider, provider_ref FROM payment_methods WHERE user_id=$1 AND deleted_at IS NULL", [user.id]);
    await tx(async (c) => {
      await query("UPDATE users SET status='withdrawn', withdrawn_at=now(), updated_at=now() WHERE id=$1", [user.id], c);
      await query("UPDATE payment_methods SET deleted_at=now() WHERE user_id=$1 AND deleted_at IS NULL", [user.id], c);
      await query("UPDATE addresses SET deleted_at=now() WHERE user_id=$1 AND deleted_at IS NULL", [user.id], c);
      await destroyAllSessions(user.id, c);
      await audit(actor(user.id), "user.withdraw", "user", user.id, {}, c);
    });
    for (const pm of pms) await getPaymentProvider(pm.provider).detach(pm.provider_ref);
    await destroySession();
    return "/";
  }, "退会手続きが完了しました。ご利用ありがとうございました。");
}
