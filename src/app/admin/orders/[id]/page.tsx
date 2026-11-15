import Link from "next/link";
import { notFound } from "next/navigation";
import { formatAddress } from "@/components/AddressFields";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { one, query } from "@/lib/db";
import { fmtDateTime, yen } from "@/lib/util";
import type { OrderStatus } from "@/lib/types";
import { adminCancelOrderAction, adminExtendPaymentDueAction, adminRetryChargeAction, updateShippingAction } from "../../actions";
import { OrderStatusChip, PageTitle } from "../../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "注文詳細" };

export default async function AdminOrder({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^\d+$/.test(id)) notFound();
  const o = await one(
    `SELECT o.*, p.title, p.id AS pid, u.email, u.name, u.id AS uid, pm.brand, pm.last4, pm.provider
       FROM orders o JOIN projects p ON p.id=o.project_id JOIN users u ON u.id=o.user_id LEFT JOIN payment_methods pm ON pm.id=o.payment_method_id
      WHERE o.id=$1`,
    [id],
  );
  if (!o) notFound();
  const [items, rewards, payments, notes, logs] = await Promise.all([
    query("SELECT * FROM order_items WHERE order_id=$1", [id]),
    query("SELECT * FROM order_rewards WHERE order_id=$1 ORDER BY target_qty", [id]),
    query("SELECT * FROM payments WHERE order_id=$1 ORDER BY id", [id]),
    query(
      "SELECT id, template, status, created_at, sent_at FROM notifications WHERE event_key ~ $1 ORDER BY id",
      [`^((order_applied|order_cancelled|project_succeeded|project_failed|payment_completed|shipped):${id}|payment_failed:${id}:\\d+)$`],
    ),
    query("SELECT * FROM audit_logs WHERE entity='order' AND entity_id=$1 ORDER BY id DESC", [String(id)]),
  ]);
  const status = o.status as OrderStatus;
  return (
    <div className="space-y-6">
      <PageTitle><span className="font-mono">{o.number}</span></PageTitle>
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-5 text-sm">
          <div className="mb-3"><OrderStatusChip s={status} /></div>
          <dl className="grid grid-cols-[7rem_1fr] gap-y-2">
            <dt className="text-xs text-ink-soft">プロジェクト</dt><dd><Link href={`/admin/projects/${o.pid}`} className="underline">{o.title}</Link></dd>
            <dt className="text-xs text-ink-soft">購入者</dt><dd><Link href={`/admin/users/${o.uid}`} className="underline">{o.name}</Link><br /><span className="text-xs">{o.email}</span></dd>
            <dt className="text-xs text-ink-soft">内容</dt><dd>{items.map((i) => <div key={i.id}>{i.variant_name || "（単一）"} × {i.quantity}</div>)}</dd>
            <dt className="text-xs text-ink-soft">金額</dt><dd>{yen(o.amount)}（{yen(o.unit_price)} × {o.quantity}）</dd>
            <dt className="text-xs text-ink-soft">確定特典</dt><dd>{rewards.length ? rewards.map((r) => <div key={r.id}>{r.title} × {r.quantity}</div>) : "—"}</dd>
            <dt className="text-xs text-ink-soft">決済方法</dt><dd>{o.brand ? `${o.provider} ${o.brand} •••• ${o.last4}` : "—"}</dd>
            <dt className="text-xs text-ink-soft">配送先</dt><dd className="text-xs">{formatAddress(o.shipping_address)}<br />TEL {o.shipping_address.phone}</dd>
            <dt className="text-xs text-ink-soft">申込日時</dt><dd>{fmtDateTime(o.created_at)}（IP {o.client_ip || "—"}）</dd>
            {o.payment_due_at && (<><dt className="text-xs text-ink-soft">再決済期限</dt><dd className="text-brand-700">{fmtDateTime(o.payment_due_at)}</dd></>)}
            {o.cancel_reason && (<><dt className="text-xs text-ink-soft">取消理由</dt><dd>{o.cancel_reason}</dd></>)}
          </dl>
        </section>

        <div className="space-y-6">
          {status === "paid" && (
            <form action={updateShippingAction} className="card space-y-3 p-5">
              <h2 className="font-bold">配送</h2>
              <input type="hidden" name="id" value={o.id} />
              <select name="fulfillment_status" defaultValue={o.fulfillment_status} className="input">
                <option value="none">未着手</option><option value="manufacturing">製造中</option><option value="preparing">発送準備中</option>
                <option value="shipped">発送済み（発送完了メール送信）</option><option value="delivered">配達完了</option>
              </select>
              <input name="carrier" defaultValue={o.carrier} placeholder="配送会社" className="input" />
              <input name="tracking_number" defaultValue={o.tracking_number} placeholder="追跡番号" className="input" />
              <SubmitButton className="btn-primary btn-sm">更新</SubmitButton>
            </form>
          )}
          {["awaiting_payment", "payment_failed"].includes(status) && (
            <div className="card space-y-3 p-5">
              <h2 className="font-bold">決済</h2>
              <form action={adminRetryChargeAction}><input type="hidden" name="id" value={o.id} /><SubmitButton className="btn-primary btn-sm" confirm="登録済みの決済方法で課金します。よろしいですか？">登録カードで再決済</SubmitButton></form>
              {status === "payment_failed" && (
                <form action={adminExtendPaymentDueAction} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={o.id} />
                  <input name="days" type="number" min={1} max={30} defaultValue={3} className="input w-20 py-2" />日
                  <SubmitButton className="btn-outline btn-sm">再決済期限を延長</SubmitButton>
                </form>
              )}
            </div>
          )}
          {!["cancelled", "void", "refunded"].includes(status) && (
            <form action={adminCancelOrderAction} className="card space-y-3 border-brand-200 p-5">
              <h2 className="font-bold text-brand-700">運営取消{status === "paid" && "・返金"}</h2>
              <input type="hidden" name="id" value={o.id} />
              <input name="reason" required placeholder="取消理由（お客様へのメールに記載されます）" className="input" />
              <SubmitButton className="btn-danger btn-sm" confirm={status === "paid" ? "取消して全額返金します。よろしいですか？" : "取消しますか？"}>取消する</SubmitButton>
            </form>
          )}
        </div>
      </div>

      <section className="card overflow-x-auto p-5">
        <h2 className="section-title">決済履歴</h2>
        <table className="table">
          <thead><tr><th>#</th><th>種別</th><th>状態</th><th>金額</th><th>試行</th><th>事業者ID</th><th>エラー</th><th>日時</th></tr></thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}><td>{p.id}</td><td>{p.kind}</td><td>{p.status}</td><td>{yen(p.amount)}</td><td>{p.attempt}</td><td className="font-mono text-xs">{p.provider}:{p.provider_payment_id}</td><td className="text-xs">{p.error_code} {p.error_message}</td><td className="text-xs">{fmtDateTime(p.created_at)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-5 text-xs">
          <h2 className="section-title">通知履歴</h2>
          {notes.map((n) => <p key={n.id}>{fmtDateTime(n.created_at)} {n.template} — {n.status}</p>)}
        </section>
        <section className="card p-5 text-xs">
          <h2 className="section-title">操作履歴</h2>
          {logs.map((l) => <p key={l.id}>{fmtDateTime(l.created_at)} <b>{l.action}</b> {l.actor_label} {l.detail?.reason ?? ""}</p>)}
        </section>
      </div>
    </div>
  );
}
