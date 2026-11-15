import Link from "next/link";
import { redirect } from "next/navigation";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { AuthCard } from "../AuthCard";
import { signupAction } from "../actions";

export const metadata = { title: "会員登録" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCurrentUser()) redirect(next);
  return (
    <AuthCard title="会員登録（無料）">
      <Flash error={sp.error} />
      <form action={signupAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div><label className="label" htmlFor="name">お名前（ニックネーム可）</label><input id="name" name="name" required maxLength={60} className="input" autoComplete="nickname" /></div>
        <div><label className="label" htmlFor="email">メールアドレス</label><input id="email" name="email" type="email" required autoComplete="email" className="input" /></div>
        <div><label className="label" htmlFor="password">パスワード（8文字以上）</label><input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="input" /></div>
        <label className="flex items-start gap-2 text-xs">
          <input type="checkbox" name="agree" required className="mt-0.5 accent-pink-600" />
          <span><Link href="/terms" className="underline" target="_blank">利用規約</Link>・<Link href="/privacy" className="underline" target="_blank">プライバシーポリシー</Link>に同意します</span>
        </label>
        <SubmitButton className="btn-pink w-full">登録してメールを確認する</SubmitButton>
      </form>
      <p className="mt-6 text-center text-xs">登録済みの方は <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-bold text-lavender-700 underline">ログイン</Link></p>
    </AuthCard>
  );
}
