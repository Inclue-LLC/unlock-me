import Link from "next/link";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { query } from "@/lib/db";
import { FULFILLMENT_LABEL } from "@/lib/types";
import { fmtDateTime } from "@/lib/util";
import { importTrackingAction } from "../actions";
import { PageTitle } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "配送" };

export default async function Shipping({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const rows = await query(
    `SELECT p.id, p.title, p.ship_estimate, o.fulfillment_status, COUNT(*)::int AS n, SUM(o.quantity)::int AS qty
       FROM orders o JOIN projects p ON p.id=o.project_id
      WHERE o.status='paid' GROUP BY p.id, p.title, p.ship_estimate, o.fulfillment_status ORDER BY p.id DESC, o.fulfillment_status`,
  );
  const recent = await query(
    `SELECT o.id, o.number, o.carrier, o.tracking_number, o.shipped_at, p.title FROM orders o JOIN projects p ON p.id=o.project_id
      WHERE o.fulfillment_status IN ('shipped','delivered') ORDER BY o.shipped_at DESC NULLS LAST LIMIT 20`,
  );
  return (
    <div className="space-y-6">
      <PageTitle>配送</PageTitle>
      <Flash ok={sp.ok} error={sp.error} />
      <section className="card overflow-x-auto p-5">
        <h2 className="section-title">プロジェクト別の発送状況（決済済み注文）</h2>
        <table className="table">
          <thead><tr><th>プロジェクト</th><th>発送予定</th><th>状況</th><th className="text-right">件数</th><th className="text-right">数量</th><th></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><Link className="underline" href={`/admin/projects/${r.id}`}>{r.title}</Link></td><td>{r.ship_estimate}</td>
                <td>{FULFILLMENT_LABEL[r.fulfillment_status] === "—" ? "未着手" : FULFILLMENT_LABEL[r.fulfillment_status]}</td>
                <td className="text-right">{r.n}</td><td className="text-right">{r.qty}</td>
                <td><Link className="btn-outline btn-sm" href={`/api/admin/exports/shipping?project=${r.id}`}>発送CSV</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <form action={importTrackingAction} className="card space-y-3 p-5">
        <h2 className="section-title">追跡番号の一括取込</h2>
        <p className="text-xs text-ink-soft">CSV形式：<code>申込番号,配送会社,追跡番号</code>（1行目がヘッダーでも可）。取込んだ注文は「発送済み」になり、発送完了メールを送信します。</p>
        <input type="file" name="file" accept=".csv,text/csv" className="text-xs" />
        <textarea name="text" rows={4} placeholder={"または直接貼り付け\nUM100001,ヤマト運輸,1234-5678-9012"} className="input font-mono text-xs" />
        <SubmitButton className="btn-primary btn-sm">取り込む</SubmitButton>
      </form>
      <section className="card overflow-x-auto p-5">
        <h2 className="section-title">最近の発送</h2>
        <table className="table"><tbody>
          {recent.map((o) => (
            <tr key={o.id}><td><Link className="font-mono underline" href={`/admin/orders/${o.id}`}>{o.number}</Link></td><td>{o.title}</td><td>{o.carrier}</td><td className="font-mono">{o.tracking_number}</td><td className="text-xs">{fmtDateTime(o.shipped_at)}</td></tr>
          ))}
        </tbody></table>
      </section>
    </div>
  );
}
