import Stripe from "stripe";
import type { ChargeResult, PaymentProvider, SavedCard } from "./types";

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key);
  }
  return client;
}

/** カード登録用 SetupIntent（オフセッション課金の同意を取得） */
export async function createSetupIntent(customerId: string) {
  const si = await stripe().setupIntents.create({
    customer: customerId,
    usage: "off_session",
    payment_method_types: ["card"],
  });
  return si.client_secret!;
}

/** クライアントで確定した SetupIntent から保存カード情報を取得（サーバー側で検証） */
export async function retrieveSetupCard(setupIntentId: string, customerId: string): Promise<SavedCard> {
  const si = await stripe().setupIntents.retrieve(setupIntentId, { expand: ["payment_method"] });
  if (si.status !== "succeeded" || si.customer !== customerId) throw new Error("カード登録を確認できませんでした");
  const pm = si.payment_method as Stripe.PaymentMethod;
  return {
    providerRef: pm.id,
    brand: pm.card?.brand ?? "",
    last4: pm.card?.last4 ?? "",
    expMonth: pm.card?.exp_month ?? null,
    expYear: pm.card?.exp_year ?? null,
  };
}

export const stripeProvider: PaymentProvider = {
  name: "stripe",
  async createCustomer({ email, userId }) {
    const c = await stripe().customers.create({ email, metadata: { user_id: String(userId) } });
    return c.id;
  },
  async charge({ customerId, methodRef, amount, idempotencyKey, description, metadata, offSession }): Promise<ChargeResult> {
    try {
      const pi = await stripe().paymentIntents.create(
        {
          amount,
          currency: "jpy",
          customer: customerId,
          payment_method: methodRef,
          confirm: true,
          off_session: offSession,
          description,
          metadata,
        },
        { idempotencyKey },
      );
      if (pi.status === "succeeded") return { status: "succeeded", paymentId: pi.id };
      if (pi.status === "requires_action" && pi.client_secret) {
        return { status: "requires_action", paymentId: pi.id, clientSecret: pi.client_secret };
      }
      return { status: "failed", paymentId: pi.id, code: pi.status, message: "決済を完了できませんでした" };
    } catch (e) {
      const err = e as Stripe.errors.StripeError;
      const pi = (err.raw as { payment_intent?: { id: string } } | undefined)?.payment_intent;
      return { status: "failed", paymentId: pi?.id, code: err.code ?? err.type ?? "error", message: err.message };
    }
  },
  async refund({ paymentId, amount, idempotencyKey }) {
    try {
      const r = await stripe().refunds.create({ payment_intent: paymentId, amount }, { idempotencyKey });
      return { ok: r.status === "succeeded" || r.status === "pending", refundId: r.id };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  },
  async detach(methodRef) {
    await stripe().paymentMethods.detach(methodRef).catch(() => {});
  },
};
