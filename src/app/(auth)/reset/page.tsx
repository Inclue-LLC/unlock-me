import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { AuthCard } from "../AuthCard";
import { resetAction } from "../actions";

export const metadata = { title: "新しいパスワードの設定" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <AuthCard title="新しいパスワードの設定">
      <Flash error={sp.error} />
      <form action={resetAction} className="space-y-4">
        <input type="hidden" name="token" value={sp.token ?? ""} />
        <div><label className="label" htmlFor="password">新しいパスワード（8文字以上）</label><input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="input" /></div>
        <div><label className="label" htmlFor="password2">確認用</label><input id="password2" name="password2" type="password" minLength={8} required autoComplete="new-password" className="input" /></div>
        <SubmitButton className="btn-primary w-full">設定する</SubmitButton>
      </form>
    </AuthCard>
  );
}
