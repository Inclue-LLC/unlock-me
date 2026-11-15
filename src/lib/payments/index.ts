import { mockProvider } from "./mock";
import { stripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export function paymentProviderName(): "mock" | "stripe" {
  return process.env.PAYMENT_PROVIDER === "stripe" ? "stripe" : "mock";
}

export function getPaymentProvider(name: string = paymentProviderName()): PaymentProvider {
  return name === "stripe" ? stripeProvider : mockProvider;
}

export type { PaymentProvider, ChargeResult, SavedCard } from "./types";
