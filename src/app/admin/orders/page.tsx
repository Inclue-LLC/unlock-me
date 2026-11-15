import Link from "next/link";
import { query } from "@/lib/db";
import { FULFILLMENT_LABEL, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/types";
import { clampInt, fmtDateTime, yen } from "@/lib/util";
import { OrderStatusChip, PageTitle, Pager } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "注文・決済" };
const PER = 50;

export default async function AdminOrders({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const page = clampInt(sp.page, 1, 10000, 1);
  const where: string[] = [];
  const params: unknown[] = [];
  if (sp.status && sp.status in ORDER_STATUS_LABEL) { params.push(sp.status); where.push(`o.status=$${params.length}`); }
  if (sp.project && /^\d+$/.test(sp.project)) { params.push(Number(sp.project)); where.push(`o.project_id=$${params.length}`); }
  if (sp.q) { params.push(`%${sp.q}%`); where.push(`(o.number ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.name ILIKE $${params.length})`); }
  params.push(PER + 1, (page - 1) * PER);
  const rows = await query(
    `SELECT o.*, p.title, u.email, u.name FROM orders o JOIN projects p ON p.id=o.project_id JOIN users u ON u.id=o.user_id
      ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY o.id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => k !== "page" && v)).toString();
  return (
    <>
      <PageTitle>注文・決済</PageTitle>
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="申込番号・メール・氏名" className="input w-64 py-2" />
        <select name="status" defaultValue={sp.status ?? ""} className="input w-48 py-2">
          <option value="">すべての状態</option>
          {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {sp.project && <input type="hidden" name="project" value={sp.project} />}
        <button className="btn-outline btn-sm">検索</button>
        {sp.project && <Link href="/admin/orders" className="btn-outline btn-sm">プロジェクト絞込解除</Link>}
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>申込番号</th><th>プロジェクト</th><th>購入者</th><th className="text-right">数量</th><th className="text-right">金額</th><th>状態</th><th>配送</th><th>申込日時</th></tr></thead>
          <tbody>
            {rows.slice(0, PER).map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/orders/${o.id}`} className="font-mono font-bold hover:underline">{o.number}</Link></td>
                <td className="max-w-56 truncate">{o.title}</td>
                <td className="text-xs">{o.name}<br /><span className="text-ink-soft">{o.email}</span></td>
                <td className="text-right">{o.quantity}</td>
                <td className="text-right">{yen(o.amount)}</td>
                <td><OrderStatusChip s={o.status as OrderStatus} /></td>
                <td className="text-xs">{FULFILLMENT_LABEL[o.fulfillment_status]}</td>
                <td className="whitespace-nowrap text-xs text-ink-soft">{fmtDateTime(o.created_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="text-center text-ink-soft">該当なし</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager page={page} hasNext={rows.length > PER} base={`/admin/orders${qs ? "?" + qs : ""}`} />
    </>
  );
}
