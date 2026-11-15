import Link from "next/link";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { one, query } from "@/lib/db";
import type { ProjectStatus } from "@/lib/types";
import { fmtDateTime, num, yen } from "@/lib/util";
import { runTickAction } from "./actions";
import { PageTitle, ProjectStatusChip, Stat } from "./ui";

export const dynamic = "force-dynamic";

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [sales, apps, judged, attention, open, recent] = await Promise.all([
    one(`SELECT COALESCE(SUM(amount),0)::bigint AS total, COUNT(*)::int AS n,
                COALESCE(SUM(amount) FILTER (WHERE paid_at >= date_trunc('month', now())),0)::bigint AS month
           FROM orders WHERE status='paid'`),
    one(`SELECT COALESCE(SUM(quantity),0)::int AS qty, COUNT(*)::int AS n, COUNT(DISTINCT user_id)::int AS users
           FROM orders WHERE status IN ('applied','awaiting_payment','payment_failed','paid')`),
    one(`SELECT COUNT(*) FILTER (WHERE status='succeeded')::int AS ok, COUNT(*) FILTER (WHERE status='failed')::int AS ng FROM projects`),
    one(`SELECT COUNT(*) FILTER (WHERE status='payment_failed')::int AS failed,
                COUNT(*) FILTER (WHERE status='awaiting_payment')::int AS awaiting,
                COUNT(*) FILTER (WHERE status='paid' AND fulfillment_status NOT IN ('shipped','delivered'))::int AS unshipped
           FROM orders`),
    query(`SELECT p.id, p.title, p.status, p.total_qty, p.ends_at,
                  (SELECT MIN(target_qty) FROM unlocks u WHERE u.project_id=p.id) AS min_target,
                  (SELECT MIN(target_qty) FROM unlocks u WHERE u.project_id=p.id AND u.target_qty > p.total_qty) AS next_target
             FROM projects p WHERE p.status IN ('open','scheduled','suspended','judging') ORDER BY p.ends_at LIMIT 20`),
    query(`SELECT o.id, o.number, o.quantity, o.amount, o.created_at, p.title FROM orders o JOIN projects p ON p.id=o.project_id ORDER BY o.id DESC LIMIT 10`),
  ]);
  const rate = judged.ok + judged.ng ? Math.round((judged.ok / (judged.ok + judged.ng)) * 100) : null;
  return (
    <div className="space-y-8">
      <PageTitle action={<form action={runTickAction}><SubmitButton className="btn-outline btn-sm">定期処理を今すぐ実行</SubmitButton></form>}>ダッシュボード</PageTitle>
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="売上（決済済み）" value={yen(sales.total)} sub={`今月 ${yen(sales.month)}・${num(sales.n)}件`} />
        <Stat label="有効申込数量" value={`${num(apps.qty)}個`} sub={`${num(apps.n)}件・${num(apps.users)}人`} />
        <Stat label="成立率" value={rate === null ? "—" : `${rate}%`} sub={`成立 ${judged.ok} / 不成立 ${judged.ng}`} />
        <Stat label="要対応" value={num(attention.failed)} sub={<>決済失敗・<Link className="underline" href="/admin/orders?status=awaiting_payment">決済待ち {attention.awaiting}</Link>・<Link className="underline" href="/admin/shipping">未発送 {attention.unshipped}</Link></>} />
      </div>

      <section>
        <h2 className="section-title">進行中のプロジェクト</h2>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>プロジェクト</th><th>状態</th><th className="text-right">申込数量</th><th>最低成立</th><th>次のUNLOCK</th><th>終了</th></tr></thead>
            <tbody>
              {open.map((p) => (
                <tr key={p.id}>
                  <td><Link className="font-bold hover:underline" href={`/admin/projects/${p.id}`}>{p.title}</Link></td>
                  <td><ProjectStatusChip s={p.status as ProjectStatus} /></td>
                  <td className="text-right tabular-nums">{num(p.total_qty)}</td>
                  <td>{p.min_target ? (p.total_qty >= p.min_target ? "✅ 達成" : `あと${num(p.min_target - p.total_qty)}`) : "未設定"}</td>
                  <td>{p.next_target ? `あと${num(p.next_target - p.total_qty)}` : "—"}</td>
                  <td className="whitespace-nowrap">{fmtDateTime(p.ends_at)}</td>
                </tr>
              ))}
              {open.length === 0 && <tr><td colSpan={6} className="text-center text-ink-soft">なし</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="section-title">最近の申込</h2>
        <div className="card overflow-x-auto">
          <table className="table">
            <tbody>
              {recent.map((o) => (
                <tr key={o.id}>
                  <td><Link className="font-mono hover:underline" href={`/admin/orders/${o.id}`}>{o.number}</Link></td>
                  <td>{o.title}</td><td className="text-right">{o.quantity}個</td><td className="text-right">{yen(o.amount)}</td>
                  <td className="whitespace-nowrap text-ink-soft">{fmtDateTime(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
