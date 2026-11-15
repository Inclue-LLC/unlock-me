import "server-only";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { ZodError } from "zod";
import { UserError } from "./util";

export function withParam(path: string, key: string, value: string) {
  const [base, hash] = path.split("#");
  const url = new URL(base, "http://x");
  url.searchParams.delete("ok");
  url.searchParams.delete("error");
  url.searchParams.set(key, value);
  return url.pathname + url.search + (hash ? `#${hash}` : "");
}

/**
 * Server Action 用ラッパー。fn は遷移先パスを返す（未指定なら back）。
 * UserError / 入力エラーは back に ?error= を付けて戻す。
 */
export async function act(back: string, fn: () => Promise<string | void>, okMessage?: string): Promise<never> {
  let dest: string;
  try {
    const r = await fn();
    dest = r ?? back;
    if (okMessage) dest = withParam(dest, "ok", okMessage);
  } catch (e) {
    if (e instanceof UserError) dest = withParam(back, "error", e.message);
    else if (e instanceof ZodError) dest = withParam(back, "error", e.issues[0]?.message ?? "入力内容を確認してください");
    else throw e;
  }
  redirect(dest);
}

export function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim();
}
