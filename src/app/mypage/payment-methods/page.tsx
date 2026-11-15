import { Flash } from "@/components/Flash";
import { StripeCardForm } from "@/components/StripeCard";
import { SubmitButton } from "@/components/SubmitButton";
import { listPaymentMethods } from "@/lib/account";
import { safeNext, requireUser } from "@/lib/auth";
import { paymentProviderName } from "@/lib/payments";
import { MOCK_CARDS } from "@/lib/payments/mock";
import { addMockCardAction, defaultPaymentMethodAction, deletePaymentMethodAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "お支払い方法" };

export default async function PaymentMethodsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser("/mypage/payment-methods");
  const pms = await listPaymentMethods(user.id);
  const next = safeNext(sp.next, "/mypage/payment-methods");
  const provider = paymentProviderName();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Flash ok={sp.ok} error={sp.error} />
      <section>
        <h2 className="section-title">登録済みのお支払い方法</h2>
        {pms.length === 0 ? <p className="text-sm text-ink-soft">登録されていません。</p> : (
          <ul className="space-y-2">
            {pms.map((m) => (
              <li key={m.id} className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <span>
                  💳 {m.brand} •••• {m.last4}
                  {m.exp_month && <span className="ml-2 text-xs text-ink-soft">有効期限 {m.exp_month}/{String(m.exp_year).slice(-2)}</span>}
                  {m.is_default && <span className="chip ml-2 bg-gray-100 text-gray-600">既定</span>}
                </span>
                <span className="flex gap-2">
                  {!m.is_default && (
                    <form action={defaultPaymentMethodAction}><input type="hidden" name="id" value={m.id} /><SubmitButton className="btn-outline btn-sm">既定にする</SubmitButton></form>
                  )}
                  <form action={deletePaymentMethodAction}><input type="hidden" name="id" value={m.id} /><SubmitButton className="btn-danger btn-sm" confirm="削除しますか？">削除</SubmitButton></form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card p-5">
        <h2 className="section-title text-base">カードを追加</h2>
        {provider === "stripe" ? (
          <StripeCardForm next={next} />
        ) : (
          <div className="space-y-3">
            <p className="notice-info text-xs">開発用の決済モックが有効です。実際のカード情報は入力しないでください。テストカードを選んで登録します。</p>
            <form action={addMockCardAction} className="space-y-3">
              <input type="hidden" name="next" value={next} />
              {Object.entries(MOCK_CARDS).map(([k, c], i) => (
                <label key={k} className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm has-[:checked]:border-brand">
                  <input type="radio" name="kind" value={k} defaultChecked={i === 0} className="accent-brand" />
                  {c.brand} •••• {c.last4}（{c.label}）
                </label>
              ))}
              <SubmitButton className="btn-primary w-full">登録する</SubmitButton>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
