import crypto from "node:crypto";
import type { ChargeResult, PaymentProvider, SavedCard } from "./types";

/**
 * 開発・テスト用の決済モック。
 * カード番号は一切受け取らず、テスト用カード種別のみ選択させる。
 *  - mock_ok_*      : 常に成功
 *  - mock_decline_* : 課金時に失敗（カード拒否）
 */
const charges = new Map<string, ChargeResult>();

export const MOCK_CARDS = {
  ok: { brand: "Visa", last4: "4242", label: "テストカード（決済成功）" },
  decline: { brand: "Mastercard", last4: "0002", label: "テストカード（決済失敗）" },
} as const;

export function mockSaveCard(kind: keyof typeof MOCK_CARDS): SavedCard {
  const c = MOCK_CARDS[kind];
  const now = new Date();
  return {
    providerRef: `mock_${kind}_${crypto.randomBytes(6).toString("hex")}`,
    brand: c.brand,
    last4: c.last4,
    expMonth: 12,
    expYear: now.getFullYear() + 3,
  };
}

export const mockProvider: PaymentProvider = {
  name: "mock",
  async createCustomer({ userId }) {
    return `mock_cus_${userId}`;
  },
  async charge({ methodRef, idempotencyKey }) {
    const memoKey = `${idempotencyKey}|${methodRef}`;
    const prev = charges.get(memoKey);
    if (prev) return prev;
    const result: ChargeResult = methodRef.startsWith("mock_decline_")
      ? { status: "failed", paymentId: `mock_pi_${crypto.randomBytes(6).toString("hex")}`, code: "card_declined", message: "カードが拒否されました" }
      : { status: "succeeded", paymentId: `mock_pi_${crypto.randomBytes(6).toString("hex")}` };
    charges.set(memoKey, result);
    return result;
  },
  async refund() {
    return { ok: true, refundId: `mock_re_${crypto.randomBytes(6).toString("hex")}` };
  },
  async detach() {},
};
