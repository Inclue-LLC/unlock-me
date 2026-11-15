import crypto from "node:crypto";

export const TZ = "Asia/Tokyo";

export function yen(n: number | string) {
  return "¥" + Number(n).toLocaleString("ja-JP");
}

export function num(n: number | string) {
  return Number(n).toLocaleString("ja-JP");
}

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Intl.DateTimeFormat("ja-JP", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
}

/** <input type="datetime-local"> 用 (JST) */
export function toLocalInput(d: Date | string | null | undefined) {
  if (!d) return "";
  const p = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
  return p.replace(" ", "T");
}

/** datetime-local の値を JST として解釈 */
export function fromLocalInput(v: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) throw new Error("日時の形式が正しくありません");
  return new Date(`${v}:00+09:00`);
}

export function remainingLabel(end: Date | string, now = new Date()) {
  const ms = new Date(end).getTime() - now.getTime();
  if (ms <= 0) return "募集終了";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `残り${days}日`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `残り${hours}時間`;
  return `残り${Math.max(1, Math.floor(ms / 60_000))}分`;
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function appUrl(path = "") {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return base + path;
}

export function clampInt(v: unknown, min: number, max: number, fallback = min) {
  const n = Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}
