/**
 * 募集状態の遷移・成立判定・成立後決済・再決済期限の処理。
 * worker（scripts/worker.ts）や /api/cron/tick から定期実行される。すべて冪等。
 *
 * 決定事項（仕様書15章の未確定項目に対する本実装の初期値）:
 *  - 決済方式: B（申込時に決済方法を保存し、成立後に課金）
 *  - 成立判定: 募集期間中の達成は「暫定表示」。募集終了時の有効申込数量で最終確定
 *  - 特典: 募集終了時に確定し注文へ保存。以後の決済失敗・取消でUNLOCKの再判定や成立取消は行わない
 *  - 決済失敗: プロジェクト毎の再決済期限（初期7日）。期限切れは注文取消
 */
import { one, query, tx, pool } from "./db";
import { audit, SYSTEM, type Actor } from "./audit";
import { kickDelivery, notify } from "./mail";
import { fanOutUnlockNotifications, recomputeTotal, reevaluateUnlocks } from "./unlock";
import { getPaymentProvider } from "./payments";
import type { Project } from "./types";
import { appUrl, fmtDateTime, num, UserError, yen } from "./util";

/** 公開予定 → 募集中 */
export async function activateScheduled(now = new Date()) {
  const rows = await query<{ id: string }>(
    "UPDATE projects SET status='open', updated_at=now() WHERE status='scheduled' AND starts_at <= $1 RETURNING id",
    [now],
  );
  for (const r of rows) await audit(SYSTEM, "project.open", "project", r.id);
  return rows.length;
}

/** 募集終了したプロジェクトの成立判定 */
export async function closeExpired(now = new Date()) {
  const rows = await query<{ id: string }>("SELECT id FROM projects WHERE status='open' AND ends_at <= $1 ORDER BY ends_at", [now]);
  for (const r of rows) await judgeProject(Number(r.id), SYSTEM);
  return rows.length;
}

/**
 * 成立判定。最小目標数量（最初のUNLOCK）を満たせば成立。
 * 成立: 確定UNLOCKを注文に紐づけ、決済待ちへ。 不成立: 申込取消（課金しない）・通知。
 */
export async function judgeProject(projectId: number, actor: Actor = SYSTEM, opts: { force?: boolean } = {}) {
  const outcome = await tx(async (c) => {
    const p = await one<Project>("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [projectId], c);
    if (!p) throw new UserError("プロジェクトが見つかりません");
    if (p.status !== "open" && p.status !== "judging") return null;
    if (!opts.force && new Date() < p.ends_at) throw new UserError("募集期間中は成立判定できません");

    const finalQty = await recomputeTotal(c, projectId);
    await reevaluateUnlocks(c, projectId, finalQty);
    const unlocks = await query<{ id: string; target_qty: number; title: string; kind: string }>(
      "SELECT id, target_qty, title, kind FROM unlocks WHERE project_id=$1 ORDER BY target_qty",
      [projectId],
      c,
    );
    await query("UPDATE unlocks SET confirmed = (target_qty <= $2) WHERE project_id=$1", [projectId, finalQty], c);
    const minTarget = unlocks[0]?.target_qty ?? Infinity;
    const succeeded = finalQty >= minTarget;
    // 確定特典（商品化以外）。最小目標は商品化決定のため特典に含めない
    const rewards = unlocks.filter((u, idx) => u.target_qty <= finalQty && !(idx === 0 || u.kind === "productization"));

    await query(
      "UPDATE projects SET status=$2, final_qty=$3, judged_at=now(), updated_at=now() WHERE id=$1",
      [projectId, succeeded ? "succeeded" : "failed", finalQty],
      c,
    );

    const orders = await query<any>(
      `SELECT o.*, u.email, u.name AS user_name FROM orders o JOIN users u ON u.id=o.user_id
        WHERE o.project_id=$1 AND o.status='applied' ORDER BY o.id`,
      [projectId],
      c,
    );
    for (const o of orders) {
      if (succeeded) {
        const lines: string[] = [];
        for (const r of rewards) {
          const qty = p.reward_unit === "per_item" ? o.quantity : 1;
          await query(
            `INSERT INTO order_rewards (order_id, unlock_id, title, target_qty, quantity) VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (order_id, unlock_id) DO NOTHING`,
            [o.id, r.id, r.title, r.target_qty, qty],
            c,
          );
          lines.push(`  ・${r.title} × ${qty}`);
        }
        await query("UPDATE orders SET status='awaiting_payment', updated_at=now() WHERE id=$1", [o.id], c);
        await notify({
          eventKey: `project_succeeded:${o.id}`, userId: Number(o.user_id), to: o.email, template: "project_succeeded",
          vars: {
            name: o.user_name || "お客", projectTitle: p.title, finalQty: num(finalQty), orderNumber: o.number, orderId: o.id,
            rewards: lines.length ? lines.join("\n") : "  （追加特典なし）", shipEstimate: p.ship_estimate || "追ってご案内します",
          },
        }, c);
      } else {
        await query("UPDATE orders SET status='void', cancelled_at=now(), cancel_reason='不成立', updated_at=now() WHERE id=$1", [o.id], c);
        await notify({
          eventKey: `project_failed:${o.id}`, userId: Number(o.user_id), to: o.email, template: "project_failed",
          vars: { name: o.user_name || "お客", projectTitle: p.title, orderNumber: o.number, minQty: num(minTarget === Infinity ? 0 : minTarget) },
        }, c);
      }
    }
    await audit(actor, succeeded ? "project.succeeded" : "project.failed", "project", projectId, { finalQty, minTarget, orders: orders.length }, c);
    return { succeeded, finalQty };
  });
  if (outcome?.succeeded) await chargeProject(projectId);
  kickDelivery();
  return outcome;
}

/** 成立プロジェクトの決済待ち注文を課金する */
export async function chargeProject(projectId: number) {
  const rows = await query<{ id: string }>("SELECT id FROM orders WHERE project_id=$1 AND status='awaiting_payment' ORDER BY id", [projectId]);
  const results = { succeeded: 0, failed: 0, pending: 0 };
  for (const r of rows) {
    const res = await chargeOrder(Number(r.id), { offSession: true });
    if (res.status === "succeeded") results.succeeded++;
    else if (res.status === "failed") results.failed++;
    else results.pending++;
  }
  return results;
}

export type ChargeOrderResult =
  | { status: "succeeded" | "failed" | "skipped"; message?: string }
  | { status: "requires_action"; clientSecret: string };

/**
 * 注文の課金（冪等）。
 * 1) 注文をロックし「pending」の決済レコードを作成（冪等キー付き）→ コミット
 * 2) 決済事業者へ課金依頼（同じ冪等キーの再送は事業者側で同一結果）
 * 3) 結果をサーバー側で反映
 */
export async function chargeOrder(orderId: number, opts: { offSession: boolean; paymentMethodId?: number; userId?: number }): Promise<ChargeOrderResult> {
  const prep = await tx(async (c) => {
    const o = await one<any>("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [orderId], c);
    if (!o) throw new UserError("注文が見つかりません");
    if (opts.userId !== undefined && Number(o.user_id) !== opts.userId) throw new UserError("注文が見つかりません");
    if (o.status !== "awaiting_payment" && o.status !== "payment_failed") return null;
    if (o.status === "payment_failed" && o.payment_due_at && new Date(o.payment_due_at) < new Date()) {
      throw new UserError("再決済期限を過ぎています");
    }
    if (opts.paymentMethodId !== undefined) {
      const pm = await one("SELECT id FROM payment_methods WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL", [opts.paymentMethodId, o.user_id], c);
      if (!pm) throw new UserError("お支払い方法を選択してください");
      await query("UPDATE orders SET payment_method_id=$2, updated_at=now() WHERE id=$1", [orderId, opts.paymentMethodId], c);
      o.payment_method_id = opts.paymentMethodId;
    }
    const pm = await one<any>("SELECT * FROM payment_methods WHERE id=$1", [o.payment_method_id], c);
    const user = await one<any>("SELECT id, email, name, payment_customer_id FROM users WHERE id=$1", [o.user_id], c);
    // 処理中（pending）の決済があればその冪等キーを再利用（障害時の再実行でも二重課金しない）
    let pay = await one<any>(
      "SELECT * FROM payments WHERE order_id=$1 AND kind='charge' AND status='pending' AND provider=$2 ORDER BY id DESC LIMIT 1",
      [orderId, pm?.provider ?? ""],
      c,
    );
    if (!(pay && pm && Number(pay.payment_method_id) === Number(pm.id))) {
      // 決済方法が変わった場合は新しい試行として扱う
      if (pay) await query("UPDATE payments SET status='failed', error_message='superseded', updated_at=now() WHERE id=$1", [pay.id], c);
      const cnt = await one<{ n: number }>("SELECT COUNT(*)::int AS n FROM payments WHERE order_id=$1 AND kind='charge'", [orderId], c);
      const attempt = (cnt?.n ?? 0) + 1;
      pay = await one<any>(
        `INSERT INTO payments (order_id, payment_method_id, provider, kind, status, amount, idempotency_key, attempt)
         VALUES ($1,$2,$3,'charge','pending',$4,$5,$6) RETURNING *`,
        [orderId, pm?.id ?? null, pm?.provider ?? "none", o.amount, `charge:${orderId}:${attempt}`, attempt],
        c,
      );
    }
    const project = await one<Project>("SELECT * FROM projects WHERE id=$1", [o.project_id], c);
    return { o, pm, user, pay, project: project! };
  });
  if (!prep) return { status: "skipped" };
  const { o, pm, user, pay, project } = prep;

  let result: Awaited<ReturnType<ReturnType<typeof getPaymentProvider>["charge"]>>;
  if (!pm || pm.deleted_at || !user.payment_customer_id) {
    result = { status: "failed", code: "no_payment_method", message: "有効なお支払い方法が登録されていません" };
  } else {
    result = await getPaymentProvider(pm.provider).charge({
      customerId: user.payment_customer_id,
      methodRef: pm.provider_ref,
      amount: o.amount,
      idempotencyKey: pay.idempotency_key,
      description: `UNLOCK ME ${o.number} ${project.title}`,
      metadata: { order_id: String(o.id), order_number: o.number, payment_id: String(pay.id) },
      offSession: opts.offSession,
    });
  }

  if (result.status === "requires_action") {
    await query("UPDATE payments SET provider_payment_id=$2, updated_at=now() WHERE id=$1", [pay.id, result.paymentId]);
    return { status: "requires_action", clientSecret: result.clientSecret };
  }
  await applyChargeResult(Number(pay.id), result.status === "succeeded"
    ? { ok: true, providerPaymentId: result.paymentId }
    : { ok: false, providerPaymentId: result.paymentId, code: result.code, message: result.message });
  return result.status === "succeeded" ? { status: "succeeded" } : { status: "failed", message: result.message };
}

/** 決済結果を反映する（課金レスポンス・Webhookの双方から呼ばれる。冪等） */
export async function applyChargeResult(
  paymentId: number,
  r: { ok: true; providerPaymentId: string } | { ok: false; providerPaymentId?: string; code: string; message: string },
) {
  await tx(async (c) => {
    const pay = await one<any>("SELECT * FROM payments WHERE id=$1 FOR UPDATE", [paymentId], c);
    if (!pay || pay.status !== "pending") return;
    const o = await one<any>(
      `SELECT o.*, u.email, u.name AS user_name, p.title AS project_title, p.ship_estimate, p.payment_retry_days
         FROM orders o JOIN users u ON u.id=o.user_id JOIN projects p ON p.id=o.project_id WHERE o.id=$1 FOR UPDATE OF o`,
      [pay.order_id],
      c,
    );
    if (r.ok) {
      await query("UPDATE payments SET status='succeeded', provider_payment_id=$2, error_code='', updated_at=now() WHERE id=$1", [paymentId, r.providerPaymentId], c);
      if (o.status === "awaiting_payment" || o.status === "payment_failed") {
        await query("UPDATE orders SET status='paid', paid_at=now(), payment_due_at=NULL, updated_at=now() WHERE id=$1", [o.id], c);
        await notify({
          eventKey: `payment_completed:${o.id}`, userId: Number(o.user_id), to: o.email, template: "payment_completed",
          vars: { name: o.user_name || "お客", orderNumber: o.number, projectTitle: o.project_title, amount: yen(o.amount), shipEstimate: o.ship_estimate || "追ってご案内します" },
        }, c);
      }
      await audit(SYSTEM, "payment.succeeded", "order", o.id, { amount: pay.amount, attempt: pay.attempt }, c);
    } else {
      await query(
        "UPDATE payments SET status='failed', provider_payment_id=COALESCE($2, provider_payment_id), error_code=$3, error_message=$4, updated_at=now() WHERE id=$1",
        [paymentId, r.providerPaymentId ?? null, r.code, r.message],
        c,
      );
      if (o.status === "awaiting_payment" || o.status === "payment_failed") {
        const due = await one<{ due: Date }>(
          `UPDATE orders SET status='payment_failed',
                  payment_due_at = COALESCE(payment_due_at, now() + make_interval(days => $2)), updated_at=now()
            WHERE id=$1 RETURNING payment_due_at AS due`,
          [o.id, o.payment_retry_days],
          c,
        );
        await notify({
          eventKey: `payment_failed:${o.id}:${pay.attempt}`, userId: Number(o.user_id), to: o.email, template: "payment_failed",
          vars: { name: o.user_name || "お客", orderNumber: o.number, orderId: o.id, projectTitle: o.project_title, dueAt: fmtDateTime(due!.due) },
        }, c);
      }
      await audit(SYSTEM, "payment.failed", "order", o.id, { code: r.code, message: r.message, attempt: pay.attempt }, c);
    }
  });
  kickDelivery();
}

/** 再決済期限切れの注文を取消（UNLOCK・成立判定は再判定しない） */
export async function expireUnpaid(now = new Date()) {
  const rows = await query<any>(
    `SELECT o.id FROM orders o WHERE o.status='payment_failed' AND o.payment_due_at < $1`,
    [now],
  );
  for (const r of rows) {
    await tx(async (c) => {
      const o = await one<any>(
        `SELECT o.*, u.email, u.name AS user_name, p.title AS project_title FROM orders o
           JOIN users u ON u.id=o.user_id JOIN projects p ON p.id=o.project_id
          WHERE o.id=$1 FOR UPDATE OF o`,
        [r.id],
        c,
      );
      if (o.status !== "payment_failed") return;
      const reason = "再決済期限切れ";
      await query("UPDATE orders SET status='cancelled', cancelled_at=now(), cancel_reason=$2, updated_at=now() WHERE id=$1", [o.id, reason], c);
      await notify({
        eventKey: `order_cancelled:${o.id}`, userId: Number(o.user_id), to: o.email, template: "order_cancelled",
        vars: { name: o.user_name || "お客", orderNumber: o.number, projectTitle: o.project_title, reason },
      }, c);
      await audit(SYSTEM, "order.payment_expired", "order", o.id, {}, c);
    });
  }
  return rows.length;
}

/** 募集終了24時間前のお知らせ（冪等） */
export async function notifyClosingSoon(now = new Date()) {
  const rows = await query<any>(
    `SELECT DISTINCT ON (p.id, u.id) p.id AS project_id, p.slug, p.title, p.ends_at, p.total_qty, u.id AS user_id, u.email, u.name,
            (SELECT MIN(target_qty) FROM unlocks x WHERE x.project_id=p.id AND x.target_qty > p.total_qty) AS next_target
       FROM projects p
       JOIN orders o ON o.project_id=p.id AND o.status='applied'
       JOIN users u ON u.id=o.user_id AND u.status='active' AND u.notify_progress
      WHERE p.status='open' AND p.ends_at > $1 AND p.ends_at <= $1::timestamptz + interval '24 hours'
        AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.event_key = 'closing_soon:' || p.id || ':' || u.id)`,
    [now],
  );
  let n = 0;
  for (const r of rows) {
    const ok = await notify({
      eventKey: `closing_soon:${r.project_id}:${r.user_id}`, userId: Number(r.user_id), to: r.email, template: "closing_soon",
      vars: {
        name: r.name || "お客", projectTitle: r.title, endsAt: fmtDateTime(r.ends_at), totalQty: num(r.total_qty),
        nextUnlockText: r.next_target ? `次のUNLOCKまであと${num(r.next_target - r.total_qty)}個！` : "すべてのUNLOCKを達成しています！",
        projectUrl: appUrl(`/projects/${r.slug}`),
      },
    });
    if (ok) n++;
  }
  return n;
}

/** 定期処理（1分間隔程度で実行） */
export async function tick(now = new Date()) {
  const opened = await activateScheduled(now);
  const closed = await closeExpired(now);
  const unlockMails = await fanOutUnlockNotifications(pool);
  const closingSoon = await notifyClosingSoon(now);
  // 成立済みで未課金の注文（障害で中断した場合など）
  const pending = await query<{ project_id: string }>(
    "SELECT DISTINCT project_id FROM orders WHERE status='awaiting_payment' AND updated_at < now() - interval '5 minutes'",
  );
  for (const p of pending) await chargeProject(Number(p.project_id));
  const expired = await expireUnpaid(now);
  const { deliverQueued } = await import("./mail");
  const mails = await deliverQueued(200);
  return { opened, closed, unlockMails, closingSoon, expired, mails };
}
