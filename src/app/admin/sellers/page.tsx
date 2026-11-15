import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { query } from "@/lib/db";
import { saveSellerAction } from "../actions";
import { PageTitle } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "出品者" };

export default async function Sellers({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const rows = await query("SELECT s.*, (SELECT COUNT(*) FROM projects p WHERE p.seller_id=s.id)::int AS projects FROM sellers s ORDER BY s.id");
  return (
    <div className="space-y-4">
      <PageTitle>出品者</PageTitle>
      <p className="text-xs text-ink-soft">初期は運営がすべての商品を登録します。出品者による商品登録・審査申請・売上精算は将来開発予定です。</p>
      <Flash ok={sp.ok} error={sp.error} />
      {[...rows, null].map((s) => (
        <form key={s?.id ?? "new"} action={saveSellerAction} className="card flex flex-wrap items-end gap-2 p-4">
          {s && <input type="hidden" name="seller_id" value={s.id} />}
          <div><label className="label">出品者名</label><input name="name" defaultValue={s?.name} required className="input py-2" placeholder={s ? "" : "新規出品者"} /></div>
          <div className="flex-1"><label className="label">説明</label><input name="description" defaultValue={s?.description} className="input py-2" /></div>
          {s && (
            <select name="status" defaultValue={s.status} className="input w-28 py-2"><option value="active">有効</option><option value="suspended">停止</option></select>
          )}
          {s && <span className="mb-3 text-xs text-ink-soft">{s.projects}件</span>}
          <SubmitButton className={s ? "btn-outline btn-sm" : "btn-primary btn-sm"}>{s ? "更新" : "追加"}</SubmitButton>
        </form>
      ))}
    </div>
  );
}
