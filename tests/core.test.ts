import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { one, pool, query } from "../src/lib/db";
import { cancelOrderByAdmin, cancelOrderByUser, createOrder } from "../src/lib/orders";
import { chargeOrder, expireUnpaid, judgeProject, tick } from "../src/lib/settlement";
import { fanOutUnlockNotifications, progressOf } from "../src/lib/unlock";
import { expire, makeProject, makeUser, resetDb } from "./helpers";

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await pool.end();
});

async function order(user: Awaited<ReturnType<typeof makeUser>>, projectId: number, quantity: number, key = Math.random().toString(36), variantId: number | null = null) {
  return createOrder({ userId: user.userId, projectId, items: [{ variantId, quantity }], addressId: user.addressId, paymentMethodId: user.paymentMethodId, idempotencyKey: key });
}

const total = async (id: number) => (await one("SELECT total_qty FROM projects WHERE id=$1", [id])).total_qty;
const achieved = async (id: number) =>
  (await query("SELECT target_qty FROM unlocks WHERE project_id=$1 AND achieved_at IS NOT NULL ORDER BY target_qty", [id])).map((r) => r.target_qty);

describe("UNLOCK判定", () => {
  it("数量は購入者数ではなく申込個数で集計し、到達した条件をUNLOCKする", async () => {
    const { projectId } = await makeProject({ targets: [3, 5, 10] });
    const a = await makeUser();
    const b = await makeUser();
    await order(a, projectId, 3);
    expect(await total(projectId)).toBe(3);
    expect(await achieved(projectId)).toEqual([3]);
    await order(b, projectId, 2);
    expect(await achieved(projectId)).toEqual([3, 5]);
  });

  it("キャンセルで数量が減ると達成表示を再判定する", async () => {
    const { projectId } = await makeProject({ targets: [3, 5] });
    const a = await makeUser();
    const { order: o } = await order(a, projectId, 5);
    expect(await achieved(projectId)).toEqual([3, 5]);
    await cancelOrderByUser(a.userId, o.id);
    expect(await total(projectId)).toBe(0);
    expect(await achieved(projectId)).toEqual([]);
  });

  it("同時申込でも数量が二重加算・欠損しない", async () => {
    const { projectId } = await makeProject({ targets: [50, 100] });
    const users = await Promise.all(Array.from({ length: 8 }, () => makeUser()));
    await Promise.all(users.flatMap((u) => [order(u, projectId, 3), order(u, projectId, 2)]));
    expect(await total(projectId)).toBe(40);
    const sum = await one("SELECT SUM(quantity)::int s FROM orders WHERE project_id=$1", [projectId]);
    expect(sum.s).toBe(40);
  });

  it("同じ冪等キーでの再送は同一注文を返す", async () => {
    const { projectId } = await makeProject();
    const a = await makeUser();
    const [r1, r2] = await Promise.all([order(a, projectId, 2, "same-key"), order(a, projectId, 2, "same-key")].map((p) => p.catch((e) => e)));
    const ok = [r1, r2].filter((r) => r.order);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(await total(projectId)).toBe(2);
  });

  it("購入上限（1回／1人）を超える申込は拒否", async () => {
    const { projectId } = await makeProject({ maxPerOrder: 3, maxPerUser: 5 });
    const a = await makeUser();
    await expect(order(a, projectId, 4)).rejects.toThrow(/3個まで/);
    await order(a, projectId, 3);
    await expect(order(a, projectId, 3)).rejects.toThrow(/5個まで/);
  });

  it("メール未認証ユーザーは申込できない", async () => {
    const { projectId } = await makeProject();
    const a = await makeUser({ verified: false });
    await expect(order(a, projectId, 1)).rejects.toThrow(/認証/);
  });

  it("バリエーションがあるプロジェクトは選択必須", async () => {
    const { projectId, variantIds } = await makeProject({ variants: ["ピンク", "ラベンダー"] });
    const a = await makeUser();
    await expect(order(a, projectId, 1)).rejects.toThrow(/バリエーション/);
    await order(a, projectId, 1, "k1", variantIds[1]);
    const item = await one("SELECT variant_name FROM order_items");
    expect(item.variant_name).toBe("ラベンダー");
  });

  it("進捗計算: 次のUNLOCKまでの残数", () => {
    const p = progressOf([{ target_qty: 300, title: "a" }, { target_qty: 500, title: "b" }, { target_qty: 1000, title: "c" }], 420);
    expect(p.remaining).toBe(80);
    expect(p.next?.target_qty).toBe(500);
    expect(p.achievedCount).toBe(1);
    expect(p.productized).toBe(true);
  });

  it("UNLOCK通知は参加者へ1回だけ配信される", async () => {
    const { projectId } = await makeProject({ targets: [2, 4] });
    const a = await makeUser();
    await order(a, projectId, 2);
    expect(await fanOutUnlockNotifications(pool)).toBe(1);
    expect(await fanOutUnlockNotifications(pool)).toBe(0);
  });
});

describe("成立判定・決済", () => {
  it("目標達成で成立し、累積特典を注文に確定・課金する（per_order）", async () => {
    const { projectId } = await makeProject({ targets: [3, 5, 10] });
    const a = await makeUser();
    const b = await makeUser();
    await order(a, projectId, 4);
    await order(b, projectId, 2);
    await expire(projectId);
    const r = await judgeProject(projectId);
    expect(r).toEqual({ succeeded: true, finalQty: 6 });
    const p = await one("SELECT status, final_qty FROM projects WHERE id=$1", [projectId]);
    expect(p.status).toBe("succeeded");
    const statuses = await query("SELECT status FROM orders WHERE project_id=$1", [projectId]);
    expect(statuses.every((s) => s.status === "paid")).toBe(true);
    const rewards = await query("SELECT title, quantity FROM order_rewards ORDER BY order_id");
    // 最初のUNLOCK（商品化）は特典に含めない。500相当（=5）達成で特典1のみ
    expect(rewards).toEqual([{ title: "特典1", quantity: 1 }, { title: "特典1", quantity: 1 }]);
    const confirmed = await query("SELECT target_qty, confirmed FROM unlocks WHERE project_id=$1 ORDER BY target_qty", [projectId]);
    expect(confirmed.map((c) => c.confirmed)).toEqual([true, true, false]);
  });

  it("per_item は購入個数分の特典を付与", async () => {
    const { projectId } = await makeProject({ targets: [1, 2, 3], rewardUnit: "per_item" });
    const a = await makeUser();
    await order(a, projectId, 3);
    await expire(projectId);
    await judgeProject(projectId);
    const rewards = await query("SELECT title, quantity FROM order_rewards ORDER BY target_qty");
    expect(rewards).toEqual([{ title: "特典1", quantity: 3 }, { title: "特典2", quantity: 3 }]);
  });

  it("最低条件未達は不成立：申込取消・課金しない・通知", async () => {
    const { projectId } = await makeProject({ targets: [10] });
    const a = await makeUser();
    await order(a, projectId, 2);
    await expire(projectId);
    const r = await judgeProject(projectId);
    expect(r?.succeeded).toBe(false);
    const o = await one("SELECT status FROM orders WHERE project_id=$1", [projectId]);
    expect(o.status).toBe("void");
    expect((await query("SELECT * FROM payments")).length).toBe(0);
    expect((await query("SELECT * FROM notifications WHERE template='project_failed'")).length).toBe(1);
  });

  it("決済失敗 → 再決済期限設定・通知 → 決済方法変更で再決済成功", async () => {
    const { projectId } = await makeProject({ targets: [1] });
    const a = await makeUser({ card: "decline" });
    const { order: o } = await order(a, projectId, 1);
    await expire(projectId);
    await judgeProject(projectId);
    let row = await one("SELECT status, payment_due_at FROM orders WHERE id=$1", [o.id]);
    expect(row.status).toBe("payment_failed");
    expect(row.payment_due_at).not.toBeNull();
    expect((await query("SELECT * FROM notifications WHERE template='payment_failed'")).length).toBe(1);

    const okPm = await one(
      "INSERT INTO payment_methods (user_id, provider, provider_ref, last4) VALUES ($1,'mock','mock_ok_x','4242') RETURNING id",
      [a.userId],
    );
    const res = await chargeOrder(o.id, { offSession: false, paymentMethodId: Number(okPm.id), userId: a.userId });
    expect(res.status).toBe("succeeded");
    row = await one("SELECT status FROM orders WHERE id=$1", [o.id]);
    expect(row.status).toBe("paid");
    // 再実行しても二重課金しない
    expect((await chargeOrder(o.id, { offSession: true })).status).toBe("skipped");
    expect((await query("SELECT * FROM payments WHERE status='succeeded'")).length).toBe(1);
  });

  it("再決済期限切れは注文取消", async () => {
    const { projectId } = await makeProject({ targets: [1] });
    const a = await makeUser({ card: "decline" });
    const { order: o } = await order(a, projectId, 1);
    await expire(projectId);
    await judgeProject(projectId);
    await query("UPDATE orders SET payment_due_at = now() - interval '1 minute' WHERE id=$1", [o.id]);
    expect(await expireUnpaid()).toBe(1);
    expect((await one("SELECT status FROM orders WHERE id=$1", [o.id])).status).toBe("cancelled");
  });

  it("運営取消（決済済み）は返金", async () => {
    const { projectId } = await makeProject({ targets: [1] });
    const a = await makeUser();
    const { order: o } = await order(a, projectId, 1);
    await expire(projectId);
    await judgeProject(projectId);
    await cancelOrderByAdmin({ id: null, label: "test" }, o.id, "テスト");
    expect((await one("SELECT status FROM orders WHERE id=$1", [o.id])).status).toBe("refunded");
    expect((await one("SELECT status FROM payments WHERE kind='refund'")).status).toBe("succeeded");
  });

  it("募集終了後は申込・キャンセル不可、tickで自動判定", async () => {
    const { projectId } = await makeProject({ targets: [1] });
    const a = await makeUser();
    const { order: o } = await order(a, projectId, 1);
    await expire(projectId);
    await expect(order(a, projectId, 1)).rejects.toThrow(/受け付けていません/);
    await expect(cancelOrderByUser(a.userId, o.id)).rejects.toThrow(/キャンセルできません/);
    const r = await tick();
    expect(r.closed).toBe(1);
    expect((await one("SELECT status FROM orders WHERE id=$1", [o.id])).status).toBe("paid");
  });
});
