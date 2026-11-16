import Link from "next/link";
import { notFound } from "next/navigation";
import { formatAddress } from "@/components/AddressFields";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { listAddresses, listPaymentMethods } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { getProjectBySlug, getUnlocks, getVariants } from "@/lib/projects";
import { fmtDateTime, num, yen } from "@/lib/util";
import { submitOrderAction } from "../actions";

export const metadata = { title: "申込内容の確認" };
export const dynamic = "force-dynamic";

export default async function ConfirmPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/projects/${slug}/apply`);
  const p = await getProjectBySlug(slug);
  if (!p) notFound();
  const [variants, addresses, pms, unlocks] = await Promise.all([getVariants(p.id), listAddresses(user.id), listPaymentMethods(user.id), getUnlocks(p.id)]);
  const items =
    variants.length === 0
      ? [{ key: "qty", label: p.title, qty: Number(sp.qty) || 0 }]
      : variants.map((v) => ({ key: `v_${v.id}`, label: v.name, qty: Number(sp[`v_${v.id}`]) || 0 }));
  const chosen = items.filter((i) => i.qty > 0);
  const qty = chosen.reduce((s, i) => s + i.qty, 0);
  const addr = addresses.find((a) => a.id === Number(sp.address));
  const pm = pms.find((m) => m.id === Number(sp.pm));
  const back = `/projects/${slug}/apply`;
  const invalid = qty === 0 ? "数量を1つ以上選択してください" : !addr ? "配送先を選択してください" : !pm ? "お支払い方法を選択してください" : null;
  const minTarget = unlocks[0]?.target_qty ?? 0;

  return (
    <div className="container-app max-w-2xl py-8">
      <h1 className="text-xl font-black">申込内容の確認</h1>
      <div className="mt-4"><Flash error={sp.error ?? invalid ?? undefined} /></div>
      {invalid ? (
        <Link href={back} className="btn-outline">入力に戻る</Link>
      ) : (
        <form action={submitOrderAction} className="space-y-4">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="address" value={addr!.id} />
          <input type="hidden" name="pm" value={pm!.id} />
          <input type="hidden" name="idem" value={crypto.randomUUID()} />
          {chosen.map((i) => <input key={i.key} type="hidden" name={i.key} value={i.qty} />)}

          <div className="card divide-y divide-line">
            <Row label="プロジェクト">{p.title}</Row>
            <Row label="種類・数量">
              <ul>{chosen.map((i) => <li key={i.key}>{i.label} × {i.qty}</li>)}</ul>
            </Row>
            <Row label="お支払い予定金額"><b className="text-lg">{yen(p.price * qty)}</b><span className="text-xs text-ink-soft">（税込・{yen(p.price)} × {qty}個）</span></Row>
            <Row label="配送先">{formatAddress(addr!)}</Row>
            <Row label="お支払い方法">{pm!.brand} •••• {pm!.last4}</Row>
            <Row label="募集終了">{fmtDateTime(p.ends_at)}</Row>
            <Row label="発送予定">{p.ship_estimate || "成立後にご案内します"}</Row>
          </div>

          <div className="card space-y-2 p-5 text-xs leading-relaxed text-ink-soft">
            <p className="font-bold text-ink">ご確認ください</p>
            <p>・本申込は<b>条件付き</b>です。募集終了時点の有効申込数量が{num(minTarget)}個以上で成立し、成立時点で売買契約が成立します。</p>
            <p>・決済は成立後に上記お支払い方法で行います。不成立の場合は申込を取り消し、代金は請求しません。</p>
            <p>・成立後に決済できなかった場合、期限（成立後{p.payment_retry_days}日）までにお支払い方法を更新いただけないとご注文は取消となります。</p>
            <p>・{p.allow_cancel ? "募集期間中はマイページからキャンセルできます。募集終了後のキャンセルはできません。" : "申込後のキャンセルはお受けできません。"}</p>
            <p>・特典は募集終了時点の達成状況で確定します。</p>
            <label className="mt-3 flex items-start gap-2 text-sm text-ink">
              <input type="checkbox" name="agree" required className="mt-1 accent-pink-600" />
              <span>上記内容・<Link href="/terms" target="_blank" className="underline">利用規約</Link>に同意して申し込みます</span>
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Link href={back} className="btn-outline flex-1">修正する</Link>
            <SubmitButton className="btn-cta flex-[2] py-4" pendingText="申込中…">この内容で申し込む</SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 p-4 text-sm sm:grid-cols-[9rem_1fr]">
      <span className="text-xs font-bold text-ink-soft">{label}</span>
      <div>{children}</div>
    </div>
  );
}
