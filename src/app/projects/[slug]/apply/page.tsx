import Link from "next/link";
import { notFound } from "next/navigation";
import { AddressFields, formatAddress } from "@/components/AddressFields";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { listAddresses, listPaymentMethods } from "@/lib/account";
import { requireUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { getUserActiveQty } from "@/lib/orders";
import { getProjectBySlug, getVariants } from "@/lib/projects";
import { yen } from "@/lib/util";
import { addAddressInlineAction } from "./actions";

export const metadata = { title: "購入申込" };
export const dynamic = "force-dynamic";

export default async function ApplyPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string>> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const user = await requireUser(`/projects/${slug}/apply`);
  const p = await getProjectBySlug(slug);
  if (!p) notFound();
  const [variants, addresses, pms, mine] = await Promise.all([
    getVariants(p.id), listAddresses(user.id), listPaymentMethods(user.id), getUserActiveQty(pool, p.id, user.id),
  ]);
  const open = p.status === "open" && new Date() < p.ends_at && new Date() >= p.starts_at;
  const maxNow = Math.max(0, Math.min(p.max_per_order, p.max_per_user - mine));
  const selectedAddr = Number(sp.address) || addresses.find((a) => a.is_default)?.id || addresses[0]?.id;
  const selectedPm = Number(sp.pm) || pms.find((m) => m.is_default)?.id || pms[0]?.id;
  const here = `/projects/${slug}/apply`;

  return (
    <div className="container-app max-w-2xl py-8">
      <Link href={`/projects/${slug}`} className="text-xs text-gray-600">← 商品ページに戻る</Link>
      <h1 className="mt-2 text-xl font-black">購入申込</h1>
      <p className="mt-1 text-sm text-ink-soft">{p.title}</p>
      <div className="mt-4"><Flash ok={sp.ok} error={sp.error} /></div>

      {!open ? (
        <p className="notice-error">このプロジェクトは現在申込を受け付けていません。</p>
      ) : !user.email_verified_at ? (
        <div className="notice-info space-y-2">
          <p>購入申込にはメールアドレスの認証が必要です。</p>
          <Link href={`/verify?next=${encodeURIComponent(here)}`} className="btn-soft btn-sm">認証メールを確認・再送する</Link>
        </div>
      ) : maxNow === 0 ? (
        <p className="notice-info">お一人様の上限（{p.max_per_user}個）まで申込済みです。</p>
      ) : (
        <div className="space-y-6">
          <form action={`/projects/${slug}/apply/confirm`} method="get" className="space-y-6">
            <section className="card p-5">
              <h2 className="section-title text-base">1. 種類・数量</h2>
              <p className="mb-3 text-xs text-ink-soft">単価 {yen(p.price)}（税込）／ 今回あと {maxNow}個 まで申込できます</p>
              {variants.length === 0 ? (
                <QtySelect name="qty" max={maxNow} label={p.title} defaultValue={1} />
              ) : (
                <div className="space-y-2">
                  {variants.map((v, i) => <QtySelect key={v.id} name={`v_${v.id}`} max={maxNow} label={v.name} defaultValue={i === 0 ? 1 : 0} />)}
                </div>
              )}
            </section>

            <section className="card p-5">
              <h2 className="section-title text-base">2. 配送先</h2>
              {addresses.length === 0 ? (
                <p className="text-sm text-ink-soft">配送先が未登録です。下のフォームから登録してください。</p>
              ) : (
                <div className="space-y-2">
                  {addresses.map((a) => (
                    <label key={a.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-50">
                      <input type="radio" name="address" value={a.id} defaultChecked={a.id === selectedAddr} required className="mt-1 accent-brand" />
                      <span>{formatAddress(a)}</span>
                    </label>
                  ))}
                </div>
              )}
            </section>

            <section className="card p-5">
              <h2 className="section-title text-base">3. お支払い方法</h2>
              <p className="mb-3 text-xs text-ink-soft">申込時には課金されません。商品化が成立した後に、選択したお支払い方法で決済します。</p>
              {pms.length === 0 ? (
                <Link href={`/mypage/payment-methods?next=${encodeURIComponent(here)}`} className="btn-soft">お支払い方法を登録する</Link>
              ) : (
                <div className="space-y-2">
                  {pms.map((m) => (
                    <label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line p-3 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-50">
                      <input type="radio" name="pm" value={m.id} defaultChecked={m.id === selectedPm} required className="accent-brand" />
                      <span>{m.brand} •••• {m.last4}{m.exp_month ? `（有効期限 ${m.exp_month}/${String(m.exp_year).slice(-2)}）` : ""}</span>
                    </label>
                  ))}
                  <Link href={`/mypage/payment-methods?next=${encodeURIComponent(here)}`} className="inline-block text-xs text-gray-600 underline">別のお支払い方法を追加</Link>
                </div>
              )}
            </section>

            <button type="submit" className="btn-cta w-full py-4" disabled={addresses.length === 0 || pms.length === 0}>申込内容を確認する</button>
          </form>

          {addresses.length === 0 && (
            <form action={addAddressInlineAction} className="card space-y-4 p-5">
              <h3 className="font-bold">配送先を登録</h3>
              <input type="hidden" name="slug" value={slug} />
              <AddressFields />
              <SubmitButton className="btn-primary w-full">この配送先を登録</SubmitButton>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function QtySelect({ name, max, label, defaultValue }: { name: string; max: number; label: string; defaultValue: number }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-line p-3 text-sm">
      <span className="font-bold">{label}</span>
      <select name={name} defaultValue={Math.min(defaultValue, max)} className="input w-24 py-2">
        {Array.from({ length: max + 1 }, (_, i) => <option key={i} value={i}>{i}</option>)}
      </select>
    </label>
  );
}
