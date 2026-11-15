import { one, query, tx, type Db } from "./db";
import { audit, type Actor } from "./audit";
import { notify } from "./mail";
import { recomputeTotal, reevaluateUnlocks } from "./unlock";
import { getPaymentProvider } from "./payments";
import type { OrderStatus, Project } from "./types";
import { ORDER_STATUS_LABEL } from "./types";
import { fmtDateTime, UserError, yen } from "./util";

export interface OrderItemInput {
  variantId: number | null;
  quantity: number;
}

export interface CreateOrderInput {
  userId: number;
  projectId: number;
  items: OrderItemInput[];
  addressId: number;
  paymentMethodId: number;
  idempotencyKey: string;
  clientIp?: string;
}

export interface OrderRow {
  id: number;
  number: string;
  user_id: number;
  project_id: number;
  status: OrderStatus;
  quantity: number;
  unit_price: number;
  amount: number;
  payment_method_id: number | null;
  payment_due_at: Date | null;
  created_at: Date;
}

function normOrder(o: any): OrderRow {
  return { ...o, id: Number(o.id), user_id: Number(o.user_id), project_id: Number(o.project_id), payment_method_id: o.payment_method_id ? Number(o.payment_method_id) : null };
}

export function validateItems(items: OrderItemInput[]) {
  const clean = items
    .map((i) => ({ variantId: i.variantId, quantity: Math.trunc(Number(i.quantity)) }))
    .filter((i) => i.quantity !== 0);
  if (clean.length === 0) throw new UserError("数量を1つ以上指定してください");
  for (const i of clean) {
    if (!Number.isInteger(i.quantity) || i.quantity < 0 || i.quantity > 1000) throw new UserError("数量が正しくありません");
  }
  const seen = new Set<string>();
  for (const i of clean) {
    const k = String(i.variantId);
    if (seen.has(k)) throw new UserError("同じバリエーションが重複しています");
    seen.add(k);
  }
  return clean;
}

/**
 * 購入申込。プロジェクト行をロックして数量を整合的に加算し、UNLOCK条件を再判定する。
 * 同じ idempotencyKey での再送は同一注文を返す（二重申込防止）。
 */
export async function createOrder(input: CreateOrderInput): Promise<{ order: OrderRow; created: boolean }> {
  const items = validateItems(input.items);
  const quantity = items.reduce((s, i) => s + i.quantity, 0);

  return tx(async (c) => {
    const user = await one<{ id: string; email: string; name: string; status: string; email_verified_at: Date | null }>(
      "SELECT id, email, name, status, email_verified_at FROM users WHERE id=$1",
      [input.userId],
      c,
    );
    if (!user || user.status !== "active") throw new UserError("このアカウントでは申込できません");
    if (!user.email_verified_at) throw new UserError("メールアドレスの認証を完了してから申込してください");

    // ── 数量整合性のためプロジェクト行をロック ──
    const project = await one<Project>("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [input.projectId], c);
    if (!project) throw new UserError("プロジェクトが見つかりません");

    const dup = await one("SELECT * FROM orders WHERE user_id=$1 AND idempotency_key=$2", [input.userId, input.idempotencyKey], c);
    if (dup) return { order: normOrder(dup), created: false };

    const now = new Date();
    if (project.status !== "open" || now < project.starts_at || now >= project.ends_at) {
      throw new UserError("このプロジェクトは現在申込を受け付けていません");
    }
    if (quantity > project.max_per_order) throw new UserError(`1回の申込は${project.max_per_order}個までです`);

    const mine = await one<{ q: number }>(
      `SELECT COALESCE(SUM(quantity),0)::int AS q FROM orders
        WHERE project_id=$1 AND user_id=$2 AND status IN ('applied','awaiting_payment','payment_failed','paid')`,
      [project.id, input.userId],
      c,
    );
    if ((mine?.q ?? 0) + quantity > project.max_per_user) {
      throw new UserError(`このプロジェクトはお一人様${project.max_per_user}個までです（申込済み: ${mine?.q ?? 0}個）`);
    }

    // バリエーション検証
    const variants = await query<{ id: string; name: string }>(
      "SELECT id, name FROM variants WHERE project_id=$1 AND is_active",
      [project.id],
      c,
    );
    const vmap = new Map(variants.map((v) => [Number(v.id), v.name]));
    for (const i of items) {
      if (variants.length === 0) {
        if (i.variantId !== null) throw new UserError("バリエーションが正しくありません");
      } else if (i.variantId === null || !vmap.has(i.variantId)) {
        throw new UserError("バリエーションを選択してください");
      }
    }

    const addr = await one(
      "SELECT name, postal_code, prefecture, city, line1, line2, phone FROM addresses WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL",
      [input.addressId, input.userId],
      c,
    );
    if (!addr) throw new UserError("配送先を選択してください");
    const pm = await one(
      "SELECT id FROM payment_methods WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL",
      [input.paymentMethodId, input.userId],
      c,
    );
    if (!pm) throw new UserError("お支払い方法を選択してください");

    const seq = await one<{ n: string }>("SELECT nextval('order_number_seq') AS n", [], c);
    const number = `UM${seq!.n}`;
    const amount = project.price * quantity;
    const order = await one(
      `INSERT INTO orders (number, user_id, project_id, quantity, unit_price, amount, shipping_address, address_id, payment_method_id, idempotency_key, client_ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [number, input.userId, project.id, quantity, project.price, amount, JSON.stringify(addr), input.addressId, input.paymentMethodId, input.idempotencyKey, input.clientIp ?? ""],
      c,
    );
    for (const i of items) {
      await query("INSERT INTO order_items (order_id, variant_id, variant_name, quantity) VALUES ($1,$2,$3,$4)", [
        order!.id,
        i.variantId,
        i.variantId !== null ? vmap.get(i.variantId) : "",
        i.quantity,
      ], c);
    }

    const total = await recomputeTotal(c, project.id);
    await reevaluateUnlocks(c, project.id, total);

    await notify(
      {
        eventKey: `order_applied:${order!.id}`,
        userId: input.userId,
        to: user.email,
        template: "order_applied",
        vars: {
          name: user.name || "お客",
          orderNumber: number,
          orderId: order!.id,
          projectTitle: project.title,
          items: items.map((i) => `  ・${i.variantId !== null ? vmap.get(i.variantId) : project.title} × ${i.quantity}`).join("\n"),
          quantity,
          amount: yen(amount),
          endsAt: fmtDateTime(project.ends_at),
        },
      },
      c,
    );
    await audit({ id: input.userId, label: `user:${input.userId}` }, "order.create", "order", order!.id, { number, quantity, amount, projectId: project.id }, c);
    return { order: normOrder(order), created: true };
  });
}

/** ユーザーによる申込キャンセル（募集期間中かつキャンセル可能なプロジェクトのみ） */
export async function cancelOrderByUser(userId: number, orderId: number) {
  return tx(async (c) => {
    const pre = await one<{ project_id: string }>("SELECT project_id FROM orders WHERE id=$1 AND user_id=$2", [orderId, userId], c);
    if (!pre) throw new UserError("注文が見つかりません");
    // ロック順序：プロジェクト → 注文
    const project = await one<Project>("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [pre.project_id], c);
    const order = await one("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [orderId], c);
    if (!project || !order) throw new UserError("注文が見つかりません");
    if (order.status !== "applied") throw new UserError("この申込はキャンセルできません");
    if (project.status !== "open" || new Date() >= project.ends_at) throw new UserError("募集終了後はキャンセルできません");
    if (!project.allow_cancel) throw new UserError("このプロジェクトは申込後のキャンセルを受け付けていません");

    await query("UPDATE orders SET status='cancelled', cancelled_at=now(), cancel_reason=$2, updated_at=now() WHERE id=$1", [orderId, "お客様によるキャンセル"], c);
    const total = await recomputeTotal(c, project.id);
    await reevaluateUnlocks(c, project.id, total);
    const user = await one("SELECT email, name FROM users WHERE id=$1", [userId], c);
    await notify({
      eventKey: `order_cancelled:${orderId}`, userId, to: user.email, template: "order_cancelled",
      vars: { name: user.name || "お客", orderNumber: order.number, projectTitle: project.title, reason: "お客様によるキャンセル" },
    }, c);
    await audit({ id: userId, label: `user:${userId}` }, "order.cancel", "order", orderId, {}, c);
  });
}

/**
 * 運営による注文取消（不正・大量申込対策、例外対応）。
 * 決済済みの場合は返金する。募集期間中なら数量を再集計してUNLOCKを再判定する。
 */
export async function cancelOrderByAdmin(actor: Actor, orderId: number, reason: string) {
  const result = await tx(async (c) => {
    const pre = await one<{ project_id: string }>("SELECT project_id FROM orders WHERE id=$1", [orderId], c);
    if (!pre) throw new UserError("注文が見つかりません");
    const project = await one<Project>("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [pre.project_id], c);
    const order = await one("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [orderId], c);
    if (["cancelled", "void", "refunded"].includes(order.status)) throw new UserError(`この注文は既に「${ORDER_STATUS_LABEL[order.status as OrderStatus]}」です`);

    let payment: any = null;
    if (order.status === "paid") {
      payment = await one(
        "SELECT * FROM payments WHERE order_id=$1 AND kind='charge' AND status='succeeded' ORDER BY id DESC LIMIT 1",
        [orderId],
        c,
      );
    }
    await query(
      "UPDATE orders SET status=$2, cancelled_at=now(), cancel_reason=$3, updated_at=now() WHERE id=$1",
      [orderId, payment ? "refunded" : "cancelled", reason || "運営による取消"],
      c,
    );
    if (project!.status === "open") {
      const total = await recomputeTotal(c, project!.id);
      await reevaluateUnlocks(c, project!.id, total);
    }
    const user = await one("SELECT email, name FROM users WHERE id=$1", [order.user_id], c);
    await notify({
      eventKey: `order_cancelled:${orderId}`, userId: Number(order.user_id), to: user.email, template: "order_cancelled",
      vars: { name: user.name || "お客", orderNumber: order.number, projectTitle: project!.title, reason: reason || "運営による取消" },
    }, c);
    await audit(actor, "order.admin_cancel", "order", orderId, { reason, refunded: !!payment, before: order.status }, c);
    return { order, payment };
  });

  // 返金は外部呼び出しのためトランザクション外で実行（冪等キー付き）
  if (result.payment) {
    await refundPayment(actor, result.payment);
  }
}

async function refundPayment(actor: Actor, payment: any) {
  const key = `refund:${payment.id}`;
  const existing = await one("SELECT * FROM payments WHERE idempotency_key=$1", [key]);
  if (existing?.status === "succeeded") return;
  if (!existing) {
    await query(
      "INSERT INTO payments (order_id, provider, kind, status, amount, idempotency_key) VALUES ($1,$2,'refund','pending',$3,$4)",
      [payment.order_id, payment.provider, payment.amount, key],
    );
  }
  const res = await getPaymentProvider(payment.provider).refund({
    paymentId: payment.provider_payment_id,
    amount: payment.amount,
    idempotencyKey: key,
  });
  await query(
    "UPDATE payments SET status=$2, provider_payment_id=$3, error_message=$4, updated_at=now() WHERE idempotency_key=$1",
    [key, res.ok ? "succeeded" : "failed", res.refundId ?? null, res.message ?? ""],
  );
  await audit(actor, res.ok ? "payment.refund" : "payment.refund_failed", "order", payment.order_id, { amount: payment.amount, message: res.message });
}

export async function getUserActiveQty(db: Db, projectId: number, userId: number) {
  const r = await one<{ q: number }>(
    `SELECT COALESCE(SUM(quantity),0)::int AS q FROM orders
      WHERE project_id=$1 AND user_id=$2 AND status IN ('applied','awaiting_payment','payment_failed','paid')`,
    [projectId, userId],
    db,
  );
  return r?.q ?? 0;
}
