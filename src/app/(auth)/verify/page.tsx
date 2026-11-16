import Link from "next/link";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { AuthCard } from "../AuthCard";
import { resendVerifyAction, verifyEmail } from "../actions";

export const metadata = { title: "メールアドレスの確認" };
export const dynamic = "force-dynamic";

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  if (sp.token) {
    const ok = await verifyEmail(sp.token);
    return (
      <AuthCard title={ok ? "認証が完了しました" : "認証できませんでした"}>
        {ok ? (
          <div className="space-y-4 text-center text-sm">
            <p>メールアドレスの確認が完了しました。<br />さっそくプロジェクトに参加しましょう！</p>
            <Link href="/" className="btn-cta w-full">プロジェクトを見る</Link>
          </div>
        ) : (
          <div className="space-y-4 text-center text-sm">
            <p className="notice-error">URLの有効期限が切れているか、既に使用されています。</p>
            <Link href="/verify" className="btn-outline w-full">認証メールを再送する</Link>
          </div>
        )}
      </AuthCard>
    );
  }
  const user = await getCurrentUser();
  const next = safeNext(sp.next, "/");
  return (
    <AuthCard title="メールアドレスの確認">
      <Flash error={sp.error} />
      {user?.email_verified_at ? (
        <p className="text-center text-sm">認証済みです。<Link href={next} className="underline">戻る</Link></p>
      ) : (
        <div className="space-y-4 text-sm">
          {sp.sent && <p className="notice-ok">確認メールを送信しました。</p>}
          <p>{user ? <b>{user.email}</b> : "ご登録のメールアドレス"} 宛てに確認メールを送信しています。メール内のURLを開いて登録を完了してください。</p>
          <p className="text-xs text-ink-soft">メールが届かない場合は迷惑メールフォルダをご確認のうえ、再送してください。</p>
          {user && (
            <form action={resendVerifyAction}><SubmitButton className="btn-outline w-full">確認メールを再送する</SubmitButton></form>
          )}
          <Link href={next} className="block text-center text-xs underline">あとで確認する</Link>
        </div>
      )}
    </AuthCard>
  );
}
