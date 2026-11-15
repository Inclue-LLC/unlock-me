import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { AuthCard } from "../AuthCard";
import { forgotAction } from "../actions";

export const metadata = { title: "パスワード再設定" };

export default async function ForgotPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <AuthCard title="パスワード再設定">
      <Flash error={sp.error} />
      {sp.sent ? (
        <p className="notice-ok">ご登録がある場合、パスワード再設定用のメールを送信しました。1時間以内にお手続きください。</p>
      ) : (
        <form action={forgotAction} className="space-y-4">
          <p className="text-xs text-ink-soft">ご登録のメールアドレスに再設定用URLをお送りします。</p>
          <div><label className="label" htmlFor="email">メールアドレス</label><input id="email" name="email" type="email" required className="input" /></div>
          <SubmitButton className="btn-primary w-full">送信する</SubmitButton>
        </form>
      )}
    </AuthCard>
  );
}
