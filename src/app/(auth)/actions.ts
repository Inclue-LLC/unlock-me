"use server";
import { z } from "zod";
import { act, clientIp, str } from "@/lib/action";
import {
  consumeEmailToken, createSession, destroyAllSessions, destroySession, getCurrentUser, hashPassword,
  issueEmailToken, safeNext, validatePassword, verifyPassword,
} from "@/lib/auth";
import { one, query, tx } from "@/lib/db";
import { kickDelivery, notify } from "@/lib/mail";
import { rateLimit } from "@/lib/ratelimit";
import { appUrl, UserError } from "@/lib/util";
import { audit } from "@/lib/audit";

const emailSchema = z.string().trim().toLowerCase().email("メールアドレスの形式が正しくありません").max(254);

export async function signupAction(fd: FormData) {
  const next = safeNext(str(fd, "next"), "/mypage");
  await act(`/signup?next=${encodeURIComponent(next)}`, async () => {
    await rateLimit(`signup:${await clientIp()}`, 10, 3600);
    const email = emailSchema.parse(str(fd, "email"));
    const name = z.string().trim().min(1, "お名前を入力してください").max(60).parse(str(fd, "name"));
    const password = String(fd.get("password") ?? "");
    validatePassword(password);
    if (fd.get("agree") !== "on") throw new UserError("利用規約・プライバシーポリシーへの同意が必要です");
    const hash = await hashPassword(password);
    const userId = await tx(async (c) => {
      const exists = await one("SELECT 1 FROM users WHERE lower(email)=$1 AND status <> 'withdrawn'", [email], c);
      if (exists) throw new UserError("このメールアドレスは既に登録されています");
      const u = await one<{ id: string }>("INSERT INTO users (email, password_hash, name) VALUES ($1,$2,$3) RETURNING id", [email, hash, name], c);
      const id = Number(u!.id);
      const token = await issueEmailToken(id, "verify", c);
      await notify({ eventKey: `verify:${id}:${Date.now()}`, userId: id, to: email, template: "verify_email", vars: { name, url: appUrl(`/verify?token=${token}`) } }, c);
      await audit({ id, label: `user:${id}` }, "user.signup", "user", id, {}, c);
      return id;
    });
    kickDelivery();
    await createSession(userId);
    return `/verify?sent=1&next=${encodeURIComponent(next)}`;
  });
}

export async function loginAction(fd: FormData) {
  const next = safeNext(str(fd, "next"));
  await act(`/login?next=${encodeURIComponent(next)}`, async () => {
    const email = str(fd, "email").toLowerCase();
    await rateLimit(`login:${await clientIp()}`, 30, 600);
    await rateLimit(`login:${email}`, 10, 600);
    const u = await one<{ id: string; password_hash: string; status: string }>(
      "SELECT id, password_hash, status FROM users WHERE lower(email)=$1 AND status <> 'withdrawn'",
      [email],
    );
    const ok = u ? await verifyPassword(String(fd.get("password") ?? ""), u.password_hash) : false;
    if (!u || !ok) throw new UserError("メールアドレスまたはパスワードが正しくありません");
    if (u.status !== "active") throw new UserError("このアカウントは利用停止されています");
    await createSession(Number(u.id));
    return next;
  });
}

export async function logoutAction() {
  await destroySession();
  await act("/", async () => {});
}

export async function resendVerifyAction() {
  await act("/verify", async () => {
    const user = await getCurrentUser();
    if (!user) return "/login?next=/verify";
    if (user.email_verified_at) return "/mypage";
    await rateLimit(`verify:${user.id}`, 5, 3600);
    const token = await issueEmailToken(user.id, "verify");
    await notify({ eventKey: `verify:${user.id}:${Date.now()}`, userId: user.id, to: user.email, template: "verify_email", vars: { name: user.name, url: appUrl(`/verify?token=${token}`) } });
    kickDelivery();
    return "/verify?sent=1";
  });
}

export async function verifyEmail(token: string): Promise<boolean> {
  return tx(async (c) => {
    const userId = await consumeEmailToken(token, "verify", c);
    if (!userId) return false;
    const u = await one<{ email: string; name: string; email_verified_at: Date | null }>(
      "UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at=now() WHERE id=$1 RETURNING email, name, email_verified_at",
      [userId],
      c,
    );
    await notify({ eventKey: `registered:${userId}`, userId, to: u!.email, template: "registered", vars: { name: u!.name } }, c);
    return true;
  });
}

export async function forgotAction(fd: FormData) {
  await act("/forgot", async () => {
    const email = emailSchema.parse(str(fd, "email"));
    await rateLimit(`forgot:${await clientIp()}`, 10, 3600);
    const u = await one<{ id: string; name: string; email: string }>(
      "SELECT id, name, email FROM users WHERE lower(email)=$1 AND status='active'",
      [email],
    );
    if (u) {
      const token = await issueEmailToken(Number(u.id), "reset");
      await notify({ eventKey: `reset:${u.id}:${Date.now()}`, userId: Number(u.id), to: u.email, template: "password_reset", vars: { name: u.name, url: appUrl(`/reset?token=${token}`) } });
      kickDelivery();
    }
    // アカウントの有無は明かさない
    return "/forgot?sent=1";
  });
}

export async function resetAction(fd: FormData) {
  const token = str(fd, "token");
  await act(`/reset?token=${encodeURIComponent(token)}`, async () => {
    const password = String(fd.get("password") ?? "");
    validatePassword(password);
    if (password !== String(fd.get("password2") ?? "")) throw new UserError("確認用パスワードが一致しません");
    const hash = await hashPassword(password);
    await tx(async (c) => {
      const userId = await consumeEmailToken(token, "reset", c);
      if (!userId) throw new UserError("URLの有効期限が切れているか、既に使用されています。もう一度お手続きください。");
      await query("UPDATE users SET password_hash=$2, email_verified_at=COALESCE(email_verified_at, now()), updated_at=now() WHERE id=$1", [userId, hash], c);
      await destroyAllSessions(userId, c);
      await audit({ id: userId, label: `user:${userId}` }, "user.password_reset", "user", userId, {}, c);
    });
    return "/login";
  }, "パスワードを再設定しました。新しいパスワードでログインしてください。");
}
