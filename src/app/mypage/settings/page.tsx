import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/auth";
import { updateNotifyAction, withdrawAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "通知設定・退会" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser("/mypage/settings");
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Flash ok={sp.ok} error={sp.error} />
      <form action={updateNotifyAction} className="card space-y-3 p-5">
        <h2 className="font-bold">メール通知設定</h2>
        <p className="text-xs text-ink-soft">申込確認・成立/不成立・決済・発送など、お取引に関するメールは設定にかかわらず送信されます。</p>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify_progress" defaultChecked={user.notify_progress} className="accent-pink-600" />参加中プロジェクトのUNLOCK達成・締切間近のお知らせ</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="notify_marketing" defaultChecked={user.notify_marketing} className="accent-pink-600" />新着プロジェクト・おすすめ情報</label>
        <SubmitButton className="btn-primary btn-sm">保存</SubmitButton>
      </form>
      <form action={withdrawAction} className="card space-y-3 border-pink-300 p-5">
        <h2 className="font-bold text-pink-700">退会</h2>
        <p className="text-xs text-ink-soft">進行中の申込や未発送の注文がある場合は退会できません。退会すると登録済みのお支払い方法・配送先は削除されます（注文履歴は法令に基づき一定期間保存します）。</p>
        <input name="password" type="password" required placeholder="パスワード" className="input" autoComplete="current-password" />
        <SubmitButton className="btn-danger btn-sm" confirm="本当に退会しますか？この操作は取り消せません。">退会する</SubmitButton>
      </form>
    </div>
  );
}
