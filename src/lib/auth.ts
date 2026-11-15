import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { one, query, type Db, pool } from "./db";
import { randomToken, sha256, UserError } from "./util";
import type { User } from "./types";

export const SESSION_COOKIE = "um_session";
const SESSION_DAYS = 30;

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export function validatePassword(pw: string) {
  if (pw.length < 8) throw new UserError("パスワードは8文字以上で入力してください");
  if (pw.length > 128) throw new UserError("パスワードが長すぎます");
}

export async function createSession(userId: number) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1,$2,$3)", [sha256(token), userId, expires]);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE id=$1", [sha256(token)]);
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: number, db: Db = pool) {
  await query("DELETE FROM sessions WHERE user_id=$1", [userId], db);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await one<User & { id: string }>(
    `SELECT u.id, u.email, u.name, u.role, u.status, u.email_verified_at, u.notify_marketing, u.notify_progress, u.payment_customer_id
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = $1 AND s.expires_at > now() AND u.status = 'active'`,
    [sha256(token)],
  );
  return row ? { ...row, id: Number(row.id) } : null;
});

export async function requireUser(next?: string): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect("/login?next=/admin");
  if (u.role !== "admin") redirect("/");
  return u;
}

/** メール認証・パスワード再設定トークン */
export async function issueEmailToken(userId: number, purpose: "verify" | "reset", db: Db = pool) {
  const token = randomToken();
  const hours = purpose === "verify" ? 72 : 1;
  await query(
    "INSERT INTO email_tokens (id, user_id, purpose, expires_at) VALUES ($1,$2,$3, now() + make_interval(hours => $4))",
    [sha256(token), userId, purpose, hours],
    db,
  );
  return token;
}

export async function consumeEmailToken(token: string, purpose: "verify" | "reset", db: Db = pool): Promise<number | null> {
  const row = await one<{ user_id: string }>(
    `UPDATE email_tokens SET used_at = now()
      WHERE id = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
      RETURNING user_id`,
    [sha256(token), purpose],
    db,
  );
  return row ? Number(row.user_id) : null;
}

/** ログイン後のリダイレクト先を自サイト内に限定する */
export function safeNext(next: unknown, fallback = "/mypage") {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}
