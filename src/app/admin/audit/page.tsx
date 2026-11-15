import { query } from "@/lib/db";
import { clampInt, fmtDateTime } from "@/lib/util";
import { PageTitle, Pager } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "操作履歴" };
const PER = 100;

export default async function Audit({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const page = clampInt(sp.page, 1, 10000, 1);
  const rows = await query(
    `SELECT * FROM audit_logs WHERE ($1='' OR entity=$1) AND ($2='' OR entity_id=$2) AND ($3='' OR action ILIKE $3||'%')
      ORDER BY id DESC LIMIT $4 OFFSET $5`,
    [sp.entity ?? "", sp.id ?? "", sp.action ?? "", PER + 1, (page - 1) * PER],
  );
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "page" && v)).toString();
  return (
    <>
      <PageTitle>操作履歴</PageTitle>
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="entity" defaultValue={sp.entity ?? ""} className="input w-40 py-2">
          <option value="">すべて</option>{["project", "order", "user", "seller", "email_template", "notification", "system"].map((e) => <option key={e}>{e}</option>)}
        </select>
        <input name="id" defaultValue={sp.id} placeholder="対象ID" className="input w-28 py-2" />
        <input name="action" defaultValue={sp.action} placeholder="操作（前方一致）" className="input w-48 py-2" />
        <button className="btn-outline btn-sm">絞込</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>日時</th><th>変更者</th><th>操作</th><th>対象</th><th>内容</th></tr></thead>
          <tbody>
            {rows.slice(0, PER).map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-xs">{fmtDateTime(l.created_at)}</td><td className="text-xs">{l.actor_label}</td>
                <td className="font-bold">{l.action}</td><td className="text-xs">{l.entity}#{l.entity_id}</td>
                <td><pre className="max-w-xl overflow-x-auto whitespace-pre-wrap text-[10px]">{JSON.stringify(l.detail, null, 1)}</pre></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} hasNext={rows.length > PER} base={`/admin/audit${qs ? "?" + qs : ""}`} />
    </>
  );
}
