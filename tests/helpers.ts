import { migrate } from "../scripts/migrate";
import { one, query } from "../src/lib/db";
import { mockSaveCard } from "../src/lib/payments/mock";

export async function resetDb() {
  await migrate({ reset: true, log: false });
}

let seq = 0;
export async function makeUser(opts: { verified?: boolean; card?: "ok" | "decline" } = {}) {
  seq++;
  const u = await one<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, email_verified_at, payment_customer_id)
     VALUES ($1,'x',$2,$3,$4) RETURNING id`,
    [`user${seq}-${Date.now()}@example.com`, `ユーザー${seq}`, opts.verified === false ? null : new Date(), `mock_cus_${seq}`],
  );
  const userId = Number(u!.id);
  const a = await one<{ id: string }>(
    `INSERT INTO addresses (user_id, name, postal_code, prefecture, city, line1, phone, is_default)
     VALUES ($1,'山田 花子','1500001','東京都','渋谷区','神宮前1-1-1','0312345678',true) RETURNING id`,
    [userId],
  );
  const card = mockSaveCard(opts.card ?? "ok");
  const pm = await one<{ id: string }>(
    `INSERT INTO payment_methods (user_id, provider, provider_ref, brand, last4, is_default) VALUES ($1,'mock',$2,$3,$4,true) RETURNING id`,
    [userId, card.providerRef, card.brand, card.last4],
  );
  return { userId, addressId: Number(a!.id), paymentMethodId: Number(pm!.id) };
}

export async function makeProject(opts: {
  targets?: number[]; maxPerOrder?: number; maxPerUser?: number; rewardUnit?: "per_order" | "per_item";
  endsInMs?: number; variants?: string[]; price?: number;
} = {}) {
  seq++;
  const p = await one<{ id: string }>(
    `INSERT INTO projects (slug, title, price, max_per_order, max_per_user, starts_at, ends_at, status, reward_unit)
     VALUES ($1,'ぬいぐるみプロジェクト',$2,$3,$4, now() - interval '1 day', now() + make_interval(secs => $5), 'open', $6) RETURNING id`,
    [`p${seq}-${Date.now()}`, opts.price ?? 3000, opts.maxPerOrder ?? 10, opts.maxPerUser ?? 100, (opts.endsInMs ?? 86_400_000) / 1000, opts.rewardUnit ?? "per_order"],
  );
  const projectId = Number(p!.id);
  const targets = opts.targets ?? [300, 500, 1000];
  for (const [i, t] of targets.entries()) {
    await query(`INSERT INTO unlocks (project_id, target_qty, title, kind) VALUES ($1,$2,$3,$4)`, [
      projectId, t, i === 0 ? "商品化決定" : `特典${i}`, i === 0 ? "productization" : "reward",
    ]);
  }
  const variantIds: number[] = [];
  for (const v of opts.variants ?? []) {
    const r = await one<{ id: string }>("INSERT INTO variants (project_id, name) VALUES ($1,$2) RETURNING id", [projectId, v]);
    variantIds.push(Number(r!.id));
  }
  return { projectId, variantIds };
}

export async function expire(projectId: number) {
  await query("UPDATE projects SET ends_at = now() - interval '1 second', starts_at = now() - interval '2 days' WHERE id=$1", [projectId]);
}
