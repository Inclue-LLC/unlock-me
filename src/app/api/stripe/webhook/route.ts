import type Stripe from "stripe";
import { one, query } from "@/lib/db";
import { stripe } from "@/lib/payments/stripe";
import { applyChargeResult } from "@/lib/settlement";

export const dynamic = "force-dynamic";

/** Stripe Webhook：署名を検証し、イベントIDで重複処理を防止する */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("webhook not configured", { status: 503 });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(body, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("invalid signature", { status: 400 });
  }
  const fresh = await query(
    "INSERT INTO payment_events (id, provider, type, payload) VALUES ($1,'stripe',$2,$3) ON CONFLICT (id) DO NOTHING RETURNING id",
    [event.id, event.type, body],
  );
  if (!fresh.length) return Response.json({ received: true, duplicate: true });

  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const pay = await one<{ id: string }>(
      "SELECT id FROM payments WHERE kind='charge' AND (provider_payment_id=$1 OR id::text=$2) ORDER BY id DESC LIMIT 1",
      [pi.id, pi.metadata?.payment_id ?? ""],
    );
    if (pay) {
      // 金額・通貨をサーバー側で検証
      const row = await one<{ amount: number }>("SELECT amount FROM payments WHERE id=$1", [pay.id]);
      if (event.type === "payment_intent.succeeded" && row && pi.amount === row.amount && pi.currency === "jpy") {
        await applyChargeResult(Number(pay.id), { ok: true, providerPaymentId: pi.id });
      } else if (event.type === "payment_intent.payment_failed") {
        const err = pi.last_payment_error;
        await applyChargeResult(Number(pay.id), { ok: false, providerPaymentId: pi.id, code: err?.code ?? "failed", message: err?.message ?? "決済に失敗しました" });
      }
    }
  }
  return Response.json({ received: true });
}
