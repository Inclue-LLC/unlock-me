import Link from "next/link";
import { notFound } from "next/navigation";
import { formatAddress } from "@/components/AddressFields";
import { Flash } from "@/components/Flash";
import { LockIcon } from "@/components/LockIcon";
import { ShareButtons } from "@/components/ShareButtons";
import { SubmitButton } from "@/components/SubmitButton";
import { StripeConfirmPayment } from "@/components/StripeCard";
import { listAddresses, listPaymentMethods } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { getUnlocks } from "@/lib/projects";
import { progressOf } from "@/lib/unlock";
import { FULFILLMENT_LABEL, ORDER_STATUS_LABEL, PROJECT_STATUS_LABEL, type OrderStatus, type ProjectStatus } from "@/lib/types";
import { appUrl, fmtDateTime, num, yen } from "@/lib/util";
import { cancelOrderAction, changeOrderAddressAction, changeOrderPaymentMethodAction, retryPaymentAction } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "注文詳細" };

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/mypage/orders/${id}`);
  if (!/^\d+$/.test(id)) notFound();
  const o = await one(
    `SELECT o.*, p.slug, p.title, p.status AS project_status, p.ends_at, p.total_qty, p.final_qty, p.allow_cancel,
            p.ship_estimate, p.main_image, p.ogp_image, pm.brand, pm.last4
       FROM orders o JOIN projects p ON p.id=o.project_id LEFT JOIN payment_methods pm ON pm.id=o.payment_method_id
      WHERE o.id=$1 AND o.user_id=$2`,
    [id, user.id],
  );
  if (!o) notFound();
  const [items, rewards, unlocks, pms, addresses, payments] = await Promise.all([
    query("SELECT * FROM order_items WHERE order_id=$1 ORDER BY id", [o.id]),
    query("SELECT * FROM order_rewards WHERE order_id=$1 ORDER BY target_qty", [o.id]),
    getUnlocks(Number(o.project_id)),
    listPaymentMethods(user.id),
    listAddresses(user.id),
    query("SELECT * FROM payments WHERE order_id=$1 ORDER BY id DESC", [o.id]),
  ]);
  const status = o.status as OrderStatus;
  const total = o.final_qty ?? o.total_qty;
  const prog = progressOf(unlocks, total);
  const canCancel = status === "applied" && o.project_status === "open" && o.allow_cancel && new Date() < new Date(o.ends_at);
  const canChangeAddr = ["applied", "awaiting_payment", "payment_failed", "paid"].includes(status) && ["none", "manufacturing"].includes(o.fulfillment_status);
  const addr = o.shipping_address;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/mypage" className="text-xs text-lavender-700">← 申込・注文一覧</Link>
      {sp.applied && (
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-br from-lavender to-pink p-6 text-center">
            <LockIcon open className="mx-auto h-10 w-10 text-pink-700" />
            <p className="mt-2 text-lg font-black">申込が完了しました！</p>
            <p className="text-xs text-ink-soft">確認メールをお送りしました。シェアしてUNLOCKを近づけよう</p>
          </div>
          <div className="p-5">
            <ShareButtons url={appUrl(`/projects/${o.slug}`)} text={`「${o.title}」に参加しました！一緒にUNLOCKしよう🔓`} image={o.ogp_image || o.main_image || undefined} />
          </div>
        </div>
      )}
      <Flash ok={sp.ok} error={sp.error} />
      {sp.confirm_payment && <StripeConfirmPayment clientSecret={sp.confirm_payment} returnPath={`/mypage/orders/${o.id}`} />}

      <div className="card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip bg-ink text-white">{ORDER_STATUS_LABEL[status]}</span>
          {o.fulfillment_status !== "none" && <span className="chip bg-cream">{FULFILLMENT_LABEL[o.fulfillment_status]}</span>}
          <span className="text-xs text-ink-soft">申込番号 {o.number}</span>
        </div>
        <Link href={`/projects/${o.slug}`} className="mt-2 block text-lg font-black hover:underline">{o.title}</Link>
        <p className="text-xs text-ink-soft">プロジェクト：{PROJECT_STATUS_LABEL[o.project_status as ProjectStatus]}・募集終了 {fmtDateTime(o.ends_at)}</p>

        <dl className="mt-4 grid grid-cols-[7rem_1fr] gap-y-2 text-sm">
          <dt className="text-xs text-ink-soft">内容</dt>
          <dd>{items.map((i) => <div key={i.id}>{i.variant_name || o.title} × {i.quantity}</div>)}</dd>
          <dt className="text-xs text-ink-soft">金額</dt><dd>{yen(o.amount)}（税込）</dd>
          <dt className="text-xs text-ink-soft">お支払い方法</dt><dd>{o.brand ? `${o.brand} •••• ${o.last4}` : "—"}</dd>
          <dt className="text-xs text-ink-soft">配送先</dt><dd className="text-xs">{formatAddress(addr)}</dd>
          <dt className="text-xs text-ink-soft">申込日時</dt><dd>{fmtDateTime(o.created_at)}</dd>
          {o.paid_at && (<><dt className="text-xs text-ink-soft">決済日時</dt><dd>{fmtDateTime(o.paid_at)}</dd></>)}
          {o.cancel_reason && (<><dt className="text-xs text-ink-soft">取消理由</dt><dd>{o.cancel_reason}</dd></>)}
        </dl>
      </div>

      {/* UNLOCK状況 */}
      <div className="card p-5">
        <h2 className="section-title text-base"><LockIcon open className="h-5 w-5 text-pink-600" />UNLOCK状況</h2>
        <p className="mb-3 text-sm">{o.final_qty !== null ? "最終" : "現在"} <b className="text-pink-700">{num(total)}個</b>・{prog.achievedCount}/{prog.count} UNLOCKED{prog.next && status === "applied" ? `・次まであと${num(prog.remaining)}個` : ""}</p>
        <ul className="space-y-2 text-sm">
          {unlocks.map((u, i) => {
            const open = o.final_qty !== null ? u.confirmed === true : u.achieved_at !== null;
            return (
              <li key={u.id} className="flex items-center gap-2">
                <LockIcon open={open} className={`h-4 w-4 ${open ? "text-pink-600" : "text-lavender-300"}`} />
                <span className="text-xs text-ink-soft">{String(i + 1).padStart(2, "0")} / {num(u.target_qty)}個</span>
                <span className={open ? "font-bold" : "text-ink-soft"}>{u.title}</span>
              </li>
            );
          })}
        </ul>
        {rewards.length > 0 && (
          <div className="mt-4 rounded-xl bg-pink-50 p-4 text-sm">
            <p className="mb-1 text-xs font-bold text-pink-700">確定特典</p>
            {rewards.map((r) => <p key={r.id}>🎁 {r.title} × {r.quantity}</p>)}
          </div>
        )}
      </div>

      {/* 配送状況 */}
      {["paid", "awaiting_payment", "payment_failed"].includes(status) && (
        <div className="card p-5 text-sm">
          <h2 className="section-title text-base">配送状況</h2>
          <dl className="grid grid-cols-[7rem_1fr] gap-y-2">
            <dt className="text-xs text-ink-soft">状況</dt><dd>{FULFILLMENT_LABEL[o.fulfillment_status] === "—" ? "準備中" : FULFILLMENT_LABEL[o.fulfillment_status]}</dd>
            <dt className="text-xs text-ink-soft">発送予定</dt><dd>{o.ship_estimate || "—"}</dd>
            {o.carrier && (<><dt className="text-xs text-ink-soft">配送会社</dt><dd>{o.carrier}</dd></>)}
            {o.tracking_number && (<><dt className="text-xs text-ink-soft">追跡番号</dt><dd className="font-mono">{o.tracking_number}</dd></>)}
            {o.shipped_at && (<><dt className="text-xs text-ink-soft">発送日時</dt><dd>{fmtDateTime(o.shipped_at)}</dd></>)}
          </dl>
        </div>
      )}

      {/* 決済失敗 → 再決済 */}
      {status === "payment_failed" && (
        <form action={retryPaymentAction} className="card space-y-3 border-pink-300 p-5">
          <h2 className="font-bold text-pink-700">お支払い方法を更新して再決済してください</h2>
          <p className="text-xs">期限：<b>{fmtDateTime(o.payment_due_at)}</b>（期限を過ぎるとご注文は取消となります）</p>
          {payments[0]?.error_message && <p className="text-xs text-ink-soft">前回のエラー：{payments[0].error_message}</p>}
          <input type="hidden" name="id" value={o.id} />
          <PmSelect pms={pms} selected={Number(o.payment_method_id)} />
          <div className="flex flex-wrap gap-2">
            <SubmitButton className="btn-pink" pendingText="決済中…">{yen(o.amount)} を決済する</SubmitButton>
            <Link href={`/mypage/payment-methods?next=/mypage/orders/${o.id}`} className="btn-outline">カードを追加</Link>
          </div>
        </form>
      )}

      {status === "applied" && pms.length > 1 && (
        <details className="card p-5">
          <summary className="cursor-pointer text-sm font-bold">お支払い方法を変更する</summary>
          <form action={changeOrderPaymentMethodAction} className="mt-3 space-y-3">
            <input type="hidden" name="id" value={o.id} />
            <PmSelect pms={pms} selected={Number(o.payment_method_id)} />
            <SubmitButton className="btn-soft btn-sm">変更する</SubmitButton>
          </form>
        </details>
      )}

      {canChangeAddr && addresses.length > 0 && (
        <details className="card p-5">
          <summary className="cursor-pointer text-sm font-bold">配送先を変更する</summary>
          <p className="mt-2 text-xs text-ink-soft">配送先は発送準備に入るまで変更できます。</p>
          <form action={changeOrderAddressAction} className="mt-3 space-y-2">
            <input type="hidden" name="id" value={o.id} />
            {addresses.map((a) => (
              <label key={a.id} className="flex items-start gap-2 rounded-xl border border-line p-3 text-xs has-[:checked]:border-pink-600">
                <input type="radio" name="address" value={a.id} defaultChecked={Number(o.address_id) === a.id} className="mt-0.5 accent-pink-600" />
                {formatAddress(a)}
              </label>
            ))}
            <div className="flex gap-2">
              <SubmitButton className="btn-soft btn-sm">変更する</SubmitButton>
              <Link href={`/mypage/addresses?next=/mypage/orders/${o.id}`} className="btn-outline btn-sm">配送先を追加</Link>
            </div>
          </form>
        </details>
      )}

      {canCancel && (
        <form action={cancelOrderAction} className="text-center">
          <input type="hidden" name="id" value={o.id} />
          <SubmitButton className="btn-danger btn-sm" confirm="この申込をキャンセルしますか？">申込をキャンセルする</SubmitButton>
          <p className="mt-2 text-[11px] text-ink-soft">募集期間中のみキャンセルできます。</p>
        </form>
      )}
    </div>
  );
}

function PmSelect({ pms, selected }: { pms: { id: number; brand: string; last4: string }[]; selected: number }) {
  if (pms.length === 0) return <p className="text-xs">登録済みのお支払い方法がありません。</p>;
  return (
    <select name="pm" defaultValue={selected} className="input">
      {pms.map((m) => <option key={m.id} value={m.id}>{m.brand} •••• {m.last4}</option>)}
    </select>
  );
}
