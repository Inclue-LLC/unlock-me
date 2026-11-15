export type ChargeResult =
  | { status: "succeeded"; paymentId: string }
  | { status: "requires_action"; paymentId: string; clientSecret: string }
  | { status: "failed"; paymentId?: string; code: string; message: string };

export interface SavedCard {
  providerRef: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
}

export interface PaymentProvider {
  readonly name: "mock" | "stripe";
  /** 事業者側の顧客IDを作成する */
  createCustomer(input: { email: string; userId: number }): Promise<string>;
  /** 成立後課金（オフセッション）。idempotencyKey で二重課金を防止 */
  charge(input: {
    customerId: string;
    methodRef: string;
    amount: number;
    idempotencyKey: string;
    description: string;
    metadata: Record<string, string>;
    offSession: boolean;
  }): Promise<ChargeResult>;
  refund(input: { paymentId: string; amount: number; idempotencyKey: string }): Promise<{ ok: boolean; refundId?: string; message?: string }>;
  detach(methodRef: string): Promise<void>;
}
