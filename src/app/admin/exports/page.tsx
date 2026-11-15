import { query } from "@/lib/db";
import { PageTitle } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "集計・出力" };

const TYPES = [
  ["orders", "注文一覧", "全注文（状態・特典・配送情報を含む）。期間指定可"],
  ["shipping", "製造・発送用（注文配送CSV）", "決済済み注文のバリエーション・SKU・確定特典・お届け先"],
  ["production", "製造数量", "決済済み注文のバリエーション別・特典別の製造数量"],
  ["sales", "売上・精算", "成立／不成立プロジェクト別の売上・返金・決済失敗"],
];

export default async function Exports() {
  const projects = await query("SELECT id, title FROM projects WHERE status <> 'draft' ORDER BY id DESC");
  return (
    <>
      <PageTitle>集計・出力（CSV）</PageTitle>
      <div className="grid gap-4 md:grid-cols-2">
        {TYPES.map(([type, name, desc]) => (
          <form key={type} action={`/api/admin/exports/${type}`} method="get" className="card space-y-3 p-5">
            <h2 className="font-bold">{name}</h2>
            <p className="text-xs text-ink-soft">{desc}</p>
            <select name="project" className="input py-2">
              <option value="">すべてのプロジェクト</option>
              {projects.map((p) => <option key={p.id} value={p.id}>#{p.id} {p.title}</option>)}
            </select>
            {type === "orders" && (
              <div className="flex items-center gap-2 text-xs"><input type="date" name="from" className="input py-2" />〜<input type="date" name="to" className="input py-2" /></div>
            )}
            <button className="btn-primary btn-sm">CSVをダウンロード</button>
          </form>
        ))}
      </div>
    </>
  );
}
