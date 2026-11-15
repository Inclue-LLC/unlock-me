import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { one, pool, query } from "../src/lib/db";
import { closeAndJudge, createProject, publishProject, saveUnlock, updateProject, type ProjectInput } from "../src/lib/admin-projects";
import { createOrder } from "../src/lib/orders";
import { makeProject, makeUser, resetDb } from "./helpers";

const actor = { id: null, label: "test-admin" };
beforeEach(resetDb);
afterAll(() => pool.end());

const base = (): ProjectInput => ({
  title: "テスト", slug: `t-${Date.now()}`, description: "", category: "", seller_id: null, price: 1000, max_per_order: 5, max_per_user: 10,
  starts_at: new Date(Date.now() - 1000), ends_at: new Date(Date.now() + 86_400_000), ship_estimate: "", notes: "", ogp_title: "",
  ogp_description: "", reward_unit: "per_order", allow_cancel: true, payment_retry_days: 7, is_featured: false, sort_order: 0,
});

describe("運営プロジェクト管理", () => {
  it("UNLOCK条件なしでは公開できず、登録後は公開できる", async () => {
    const id = await createProject(actor, base(), {});
    await expect(publishProject(actor, id)).rejects.toThrow(/UNLOCK条件/);
    await saveUnlock(actor, id, null, { target_qty: 5, title: "商品化", description: "" }, null, "");
    await publishProject(actor, id);
    expect((await one("SELECT status FROM projects WHERE id=$1", [id])).status).toBe("open");
    expect((await one("SELECT kind FROM unlocks WHERE project_id=$1", [id])).kind).toBe("productization");
  });

  it("公開後のUNLOCK条件・価格変更は理由必須、履歴と参加者通知が残る", async () => {
    const { projectId } = await makeProject({ targets: [3, 5] });
    const u = await makeUser();
    await createOrder({ userId: u.userId, projectId, items: [{ variantId: null, quantity: 1 }], addressId: u.addressId, paymentMethodId: u.paymentMethodId, idempotencyKey: "k" });
    const unlock = await one("SELECT id FROM unlocks WHERE project_id=$1 AND target_qty=5", [projectId]);
    await expect(saveUnlock(actor, projectId, Number(unlock.id), { target_qty: 6, title: "特典", description: "" }, null, "")).rejects.toThrow(/理由/);
    await saveUnlock(actor, projectId, Number(unlock.id), { target_qty: 6, title: "特典", description: "" }, null, "仕様変更");
    expect((await one("SELECT action, detail->>'reason' AS r FROM audit_logs WHERE action='unlock.exception_change'")).r).toBe("仕様変更");
    expect((await query("SELECT * FROM notifications WHERE template='condition_changed'")).length).toBe(1);

    const p = await one("SELECT * FROM projects WHERE id=$1", [projectId]);
    const input = { ...base(), slug: p.slug, title: p.title, starts_at: p.starts_at, ends_at: p.ends_at, max_per_order: p.max_per_order, max_per_user: p.max_per_user, price: 9999 };
    await expect(updateProject(actor, projectId, input, {}, "")).rejects.toThrow(/例外変更理由/);
  });

  it("早期終了で成立判定まで実行される", async () => {
    const { projectId } = await makeProject({ targets: [1] });
    const u = await makeUser();
    await createOrder({ userId: u.userId, projectId, items: [{ variantId: null, quantity: 1 }], addressId: u.addressId, paymentMethodId: u.paymentMethodId, idempotencyKey: "k" });
    const r = await closeAndJudge(actor, projectId);
    expect(r?.succeeded).toBe(true);
    expect((await one("SELECT status FROM orders")).status).toBe("paid");
  });
});
