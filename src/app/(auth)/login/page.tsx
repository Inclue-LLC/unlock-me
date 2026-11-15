import Link from "next/link";
import { redirect } from "next/navigation";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { AuthCard } from "../AuthCard";
import { loginAction } from "../actions";

export const metadata = { title: "ログイン" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthCard title="ログイン">
      <Flash ok={sp.ok} error={sp.error} />
      <form action={loginAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div><label className="label" htmlFor="email">メールアドレス</label><input id="email" name="email" type="email" required autoComplete="email" className="input" /></div>
        <div><label className="label" htmlFor="password">パスワード</label><input id="password" name="password" type="password" required autoComplete="current-password" className="input" /></div>
        <SubmitButton className="btn-primary w-full">ログイン</SubmitButton>
      </form>
      <div className="mt-6 space-y-2 text-center text-xs">
        <p><Link href="/forgot" className="text-ink-soft underline">パスワードをお忘れの方</Link></p>
        <p>はじめての方は <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-bold text-pink-700 underline">会員登録</Link></p>
      </div>
    </AuthCard>
  );
}
