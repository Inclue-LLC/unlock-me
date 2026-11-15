import { z } from "zod";
import { one, query, tx } from "./db";
import { getPaymentProvider, paymentProviderName, type SavedCard } from "./payments";
import { UserError } from "./util";

export const addressSchema = z.object({
  name: z.string().trim().min(1, "お名前を入力してください").max(60),
  postal_code: z.string().trim().regex(/^\d{7}$/, "郵便番号は7桁の数字で入力してください"),
  prefecture: z.string().trim().min(1, "都道府県を選択してください"),
  city: z.string().trim().min(1, "市区町村を入力してください").max(60),
  line1: z.string().trim().min(1, "番地を入力してください").max(100),
  line2: z.string().trim().max(100).default(""),
  phone: z.string().trim().regex(/^\d{10,11}$/, "電話番号は10〜11桁の数字で入力してください"),
});

export function parseAddress(fd: FormData) {
  return addressSchema.parse(Object.fromEntries(["name", "postal_code", "prefecture", "city", "line1", "line2", "phone"].map((k) => [k, String(fd.get(k) ?? "")])));
}

export async function listAddresses(userId: number) {
  const rows = await query("SELECT * FROM addresses WHERE user_id=$1 AND deleted_at IS NULL ORDER BY is_default DESC, id", [userId]);
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

export async function addAddress(userId: number, a: z.infer<typeof addressSchema>) {
  return tx(async (c) => {
    const cnt = await one<{ n: number }>("SELECT COUNT(*)::int n FROM addresses WHERE user_id=$1 AND deleted_at IS NULL", [userId], c);
    if ((cnt?.n ?? 0) >= 10) throw new UserError("配送先は10件まで登録できます");
    const r = await one<{ id: string }>(
      `INSERT INTO addresses (user_id, name, postal_code, prefecture, city, line1, line2, phone, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [userId, a.name, a.postal_code, a.prefecture, a.city, a.line1, a.line2, a.phone, (cnt?.n ?? 0) === 0],
      c,
    );
    return Number(r!.id);
  });
}

export async function listPaymentMethods(userId: number) {
  const rows = await query(
    "SELECT id, provider, brand, last4, exp_month, exp_year, is_default FROM payment_methods WHERE user_id=$1 AND deleted_at IS NULL ORDER BY is_default DESC, id",
    [userId],
  );
  return rows.map((r) => ({ ...r, id: Number(r.id) }));
}

export async function ensureCustomer(user: { id: number; email: string }) {
  const row = await one<{ payment_customer_id: string | null }>("SELECT payment_customer_id FROM users WHERE id=$1", [user.id]);
  if (row?.payment_customer_id) return row.payment_customer_id;
  const id = await getPaymentProvider().createCustomer({ email: user.email, userId: user.id });
  await query("UPDATE users SET payment_customer_id=$2 WHERE id=$1 AND payment_customer_id IS NULL", [user.id, id]);
  const again = await one<{ payment_customer_id: string }>("SELECT payment_customer_id FROM users WHERE id=$1", [user.id]);
  return again!.payment_customer_id;
}

export async function savePaymentMethod(userId: number, card: SavedCard) {
  return tx(async (c) => {
    const cnt = await one<{ n: number }>("SELECT COUNT(*)::int n FROM payment_methods WHERE user_id=$1 AND deleted_at IS NULL", [userId], c);
    if ((cnt?.n ?? 0) >= 5) throw new UserError("お支払い方法は5件まで登録できます");
    const r = await one<{ id: string }>(
      `INSERT INTO payment_methods (user_id, provider, provider_ref, brand, last4, exp_month, exp_year, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [userId, paymentProviderName(), card.providerRef, card.brand, card.last4, card.expMonth, card.expYear, (cnt?.n ?? 0) === 0],
      c,
    );
    return Number(r!.id);
  });
}
