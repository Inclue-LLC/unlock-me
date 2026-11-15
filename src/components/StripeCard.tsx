"use client";
import { loadStripe, type Stripe, type StripeCardElement } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createSetupIntentAction, saveStripeCardAction } from "@/app/mypage/actions";

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe() {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key) return Promise.resolve(null);
  stripePromise ??= loadStripe(key);
  return stripePromise;
}

/** Stripe Elements によるカード登録。カード番号はStripeへ直接送信され、当サービスのサーバーには届かない。 */
export function StripeCardForm({ next }: { next: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<StripeCardElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let el: StripeCardElement | null = null;
    getStripe().then((stripe) => {
      if (!stripe || !ref.current) return setError("決済設定が読み込めませんでした");
      el = stripe.elements({ locale: "ja" }).create("card", { hidePostalCode: true, style: { base: { fontSize: "16px", color: "#1F2937" } } });
      el.mount(ref.current);
      setCard(el);
    });
    return () => el?.destroy();
  }, []);

  const submit = async () => {
    if (!card) return;
    setBusy(true);
    setError(null);
    try {
      const stripe = (await getStripe())!;
      const { clientSecret } = await createSetupIntentAction();
      const res = await stripe.confirmCardSetup(clientSecret, { payment_method: { card } });
      if (res.error) throw new Error(res.error.message);
      const saved = await saveStripeCardAction(res.setupIntent!.id);
      if (!saved.ok) throw new Error(saved.error);
      router.push(next + (next.includes("?") ? "&" : "?") + "ok=" + encodeURIComponent("お支払い方法を登録しました"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div ref={ref} className="input py-4" />
      {error && <p className="notice-error">{error}</p>}
      <button type="button" className="btn-primary w-full" onClick={submit} disabled={!card || busy}>{busy ? "登録中…" : "カードを登録する"}</button>
      <p className="text-[11px] text-ink-soft">カード情報は決済事業者（Stripe）で安全に保管され、UNLOCK ME では保持しません。成立後の課金に利用することに同意したものとみなします。</p>
    </div>
  );
}

/** 3Dセキュア等の追加認証が必要な場合の確認 */
export function StripeConfirmPayment({ clientSecret, returnPath }: { clientSecret: string; returnPath: string }) {
  const router = useRouter();
  const [msg, setMsg] = useState("追加認証を行っています…");
  useEffect(() => {
    getStripe().then(async (stripe) => {
      if (!stripe) return setMsg("決済設定が読み込めませんでした");
      const r = await stripe.confirmCardPayment(clientSecret);
      if (r.error) setMsg(`認証できませんでした：${r.error.message}`);
      else {
        setMsg("決済が完了しました。反映まで少しお待ちください。");
        setTimeout(() => router.replace(returnPath), 2500);
      }
    });
  }, [clientSecret, returnPath, router]);
  return <p className="notice-info">{msg}</p>;
}
