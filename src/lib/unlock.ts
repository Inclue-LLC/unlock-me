import { query, type Db, pool } from "./db";
import { notify } from "./mail";
import type { Unlock } from "./types";
import { ACTIVE_ORDER_STATUSES } from "./types";
import { appUrl, fmtDateTime, num } from "./util";

/** 有効申込数量をサーバー側で再集計する（取消済み・無効な申込は除外）。 */
export async function recomputeTotal(db: Db, projectId: number): Promise<number> {
  const rows = await query<{ total: number }>(
    `UPDATE projects SET total_qty = (
        SELECT COALESCE(SUM(quantity),0)::int FROM orders WHERE project_id=$1 AND status = ANY($2)
     ), updated_at = now()
     WHERE id=$1 RETURNING total_qty AS total`,
    [projectId, ACTIVE_ORDER_STATUSES],
    db,
  );
  return rows[0]?.total ?? 0;
}

/**
 * 全UNLOCK条件を数量変動の都度再判定する（募集期間中の達成表示）。
 * 呼び出し側でプロジェクト行をロックしていること。
 * 新たに達成した条件を返す。
 */
export async function reevaluateUnlocks(db: Db, projectId: number, total: number): Promise<Unlock[]> {
  const achieved = await query<Unlock>(
    `UPDATE unlocks SET achieved_at = now()
      WHERE project_id=$1 AND target_qty <= $2 AND achieved_at IS NULL
      RETURNING *`,
    [projectId, total],
    db,
  );
  await query(
    `UPDATE unlocks SET achieved_at = NULL WHERE project_id=$1 AND target_qty > $2 AND achieved_at IS NOT NULL`,
    [projectId, total],
    db,
  );
  return achieved.map(normalizeUnlock);
}

export function normalizeUnlock(u: Unlock): Unlock {
  return { ...u, id: Number(u.id), project_id: Number(u.project_id) };
}

/** 昇順のUNLOCK条件から進捗情報を計算 */
export function progressOf(unlocks: Pick<Unlock, "target_qty" | "title">[], total: number) {
  const sorted = [...unlocks].sort((a, b) => a.target_qty - b.target_qty);
  const next = sorted.find((u) => u.target_qty > total) ?? null;
  const prevTarget = [...sorted].reverse().find((u) => u.target_qty <= total)?.target_qty ?? 0;
  const achievedCount = sorted.filter((u) => u.target_qty <= total).length;
  const max = sorted.length ? sorted[sorted.length - 1].target_qty : 0;
  const min = sorted.length ? sorted[0].target_qty : 0;
  // 次の目標に向けた区間の進捗率
  const segmentPct = next ? Math.min(100, Math.round(((total - prevTarget) / (next.target_qty - prevTarget)) * 100)) : 100;
  const overallPct = max ? Math.min(100, Math.round((total / max) * 100)) : 0;
  return {
    next,
    remaining: next ? next.target_qty - total : 0,
    achievedCount,
    count: sorted.length,
    productized: sorted.length > 0 && total >= min,
    minTarget: min,
    maxTarget: max,
    segmentPct,
    overallPct,
  };
}

/**
 * 達成済みUNLOCKの通知を参加者へ配信する（冪等）。
 * 達成時点より前に申込んだ有効注文のユーザーが対象。workerからも定期実行される。
 */
export async function fanOutUnlockNotifications(db: Db = pool, projectId?: number): Promise<number> {
  const rows = await query<{
    unlock_id: string; target_qty: number; unlock_title: string; kind: string;
    project_id: string; slug: string; project_title: string; ends_at: Date;
    user_id: string; email: string; name: string; min_target: number;
  }>(
    `SELECT DISTINCT ON (u.id, o.user_id)
            u.id AS unlock_id, u.target_qty, u.title AS unlock_title, u.kind,
            p.id AS project_id, p.slug, p.title AS project_title, p.ends_at,
            us.id AS user_id, us.email, us.name,
            (SELECT MIN(target_qty) FROM unlocks WHERE project_id=p.id) AS min_target
       FROM unlocks u
       JOIN projects p ON p.id = u.project_id AND p.status = 'open'
       JOIN orders o ON o.project_id = p.id AND o.status = ANY($1) AND o.created_at <= u.achieved_at
       JOIN users us ON us.id = o.user_id AND us.status='active' AND us.notify_progress
      WHERE u.achieved_at IS NOT NULL
        AND ($2::bigint IS NULL OR p.id = $2)
        AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.event_key = 'unlock:' || u.id || ':user:' || o.user_id)`,
    [ACTIVE_ORDER_STATUSES, projectId ?? null],
    db,
  );
  let n = 0;
  for (const r of rows) {
    const isProductization = r.kind === "productization" || r.target_qty === r.min_target;
    const ok = await notify(
      {
        eventKey: `unlock:${r.unlock_id}:user:${r.user_id}`,
        userId: Number(r.user_id),
        to: r.email,
        template: isProductization ? "unlock_productization" : "unlock_reward",
        vars: {
          name: r.name || "お客",
          projectTitle: r.project_title,
          unlockTitle: r.unlock_title,
          targetQty: num(r.target_qty),
          endsAt: fmtDateTime(r.ends_at),
          projectUrl: appUrl(`/projects/${r.slug}`),
        },
      },
      db,
    );
    if (ok) n++;
  }
  return n;
}
