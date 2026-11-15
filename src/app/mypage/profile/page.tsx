import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/auth";
import { changeEmailAction, changePasswordAction, updateProfileAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "プロフィール" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser("/mypage/profile");
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Flash ok={sp.ok} error={sp.error} />
      <form action={updateProfileAction} className="card space-y-3 p-5">
        <h2 className="font-bold">お名前</h2>
        <input name="name" defaultValue={user.name} required maxLength={60} className="input" />
        <SubmitButton className="btn-primary btn-sm">保存</SubmitButton>
      </form>
      <form action={changeEmailAction} className="card space-y-3 p-5">
        <h2 className="font-bold">メールアドレス</h2>
        <p className="text-xs text-ink-soft">現在：{user.email}{user.email_verified_at ? "（認証済み）" : "（未認証）"}</p>
        <input name="email" type="email" required placeholder="新しいメールアドレス" className="input" />
        <input name="password" type="password" required placeholder="現在のパスワード" className="input" autoComplete="current-password" />
        <SubmitButton className="btn-primary btn-sm">変更する</SubmitButton>
      </form>
      <form action={changePasswordAction} className="card space-y-3 p-5">
        <h2 className="font-bold">パスワード</h2>
        <input name="current" type="password" required placeholder="現在のパスワード" className="input" autoComplete="current-password" />
        <input name="password" type="password" required minLength={8} placeholder="新しいパスワード（8文字以上）" className="input" autoComplete="new-password" />
        <SubmitButton className="btn-primary btn-sm">変更する</SubmitButton>
      </form>
    </div>
  );
}
