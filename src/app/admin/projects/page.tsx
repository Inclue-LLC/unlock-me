import Link from "next/link";
import { query } from "@/lib/db";
import type { ProjectStatus } from "@/lib/types";
import { fmtDateTime, num, yen } from "@/lib/util";
import { PageTitle, ProjectStatusChip } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "プロジェクト" };

export default async function AdminProjects() {
  const rows = await query(
    `SELECT p.*, (SELECT COUNT(*) FROM unlocks u WHERE u.project_id=p.id)::int AS unlock_count,
            (SELECT COUNT(*) FILTER (WHERE achieved_at IS NOT NULL) FROM unlocks u WHERE u.project_id=p.id)::int AS achieved
       FROM projects p ORDER BY CASE p.status WHEN 'open' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'draft' THEN 2 WHEN 'suspended' THEN 3 ELSE 4 END, p.sort_order, p.id DESC`,
  );
  return (
    <>
      <PageTitle action={<Link href="/admin/projects/new" className="btn-primary btn-sm">＋ 新規作成</Link>}>プロジェクト</PageTitle>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>ID</th><th>商品名</th><th>状態</th><th className="text-right">価格</th><th className="text-right">申込</th><th>UNLOCK</th><th>募集期間</th><th>表示順</th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="text-ink-soft">{p.id}</td>
                <td><Link href={`/admin/projects/${p.id}`} className="font-bold hover:underline">{p.title}</Link>{p.is_featured && <span className="chip ml-1 bg-pink-50 text-pink-700">おすすめ</span>}</td>
                <td><ProjectStatusChip s={p.status as ProjectStatus} /></td>
                <td className="text-right">{yen(p.price)}</td>
                <td className="text-right tabular-nums">{num(p.final_qty ?? p.total_qty)}</td>
                <td>{p.achieved}/{p.unlock_count}</td>
                <td className="whitespace-nowrap text-xs">{fmtDateTime(p.starts_at)}<br />〜 {fmtDateTime(p.ends_at)}</td>
                <td>{p.sort_order}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
