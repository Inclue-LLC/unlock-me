import { one, query } from "./db";
import type { Project, Unlock, Variant } from "./types";
import { normalizeUnlock } from "./unlock";

export interface ProjectCardData extends Project {
  targets: number[];
  unlock_titles: string[];
  unlock_images: string[];
}

const CARD_SELECT = `
  SELECT p.*, s.name AS seller_name,
         COALESCE(ARRAY(SELECT target_qty FROM unlocks u WHERE u.project_id=p.id ORDER BY target_qty), '{}') AS targets,
         COALESCE(ARRAY(SELECT title FROM unlocks u WHERE u.project_id=p.id ORDER BY target_qty), '{}') AS unlock_titles,
         COALESCE(ARRAY(SELECT image FROM unlocks u WHERE u.project_id=p.id ORDER BY target_qty), '{}') AS unlock_images
    FROM projects p LEFT JOIN sellers s ON s.id = p.seller_id`;

function norm<T extends { id: unknown; seller_id?: unknown }>(p: T): T {
  return { ...p, id: Number(p.id), seller_id: p.seller_id ? Number(p.seller_id) : null };
}

export type Section = "featured" | "soon" | "new" | "ending" | "unlocked";

/** トップページの分類。初期は運営が表示順（sort_order）を管理する。 */
export async function listSection(section: Section, limit = 8): Promise<ProjectCardData[]> {
  const visible = `p.status IN ('open','judging','succeeded')`;
  let where = `p.status='open'`;
  let order = `p.sort_order, p.ends_at`;
  switch (section) {
    case "featured":
      where = `p.status='open' AND p.is_featured`;
      break;
    case "soon": // もうすぐUNLOCK：次の目標までの残りが少ない（目標比20%以内）
      where = `p.status='open' AND EXISTS (SELECT 1 FROM unlocks u WHERE u.project_id=p.id AND u.target_qty > p.total_qty
                 AND (u.target_qty - p.total_qty) <= GREATEST(10, u.target_qty * 0.2)
                 AND u.target_qty = (SELECT MIN(target_qty) FROM unlocks x WHERE x.project_id=p.id AND x.target_qty > p.total_qty))`;
      order = `(SELECT MIN(target_qty) FROM unlocks x WHERE x.project_id=p.id AND x.target_qty > p.total_qty) - p.total_qty, p.sort_order`;
      break;
    case "new":
      order = `p.starts_at DESC`;
      break;
    case "ending":
      where = `p.status='open' AND p.ends_at <= now() + interval '3 days'`;
      order = `p.ends_at`;
      break;
    case "unlocked":
      where = `${visible} AND EXISTS (SELECT 1 FROM unlocks u WHERE u.project_id=p.id AND u.achieved_at IS NOT NULL)`;
      order = `p.status='open' DESC, p.sort_order, p.total_qty DESC`;
      break;
  }
  const rows = await query(`${CARD_SELECT} WHERE ${where} ORDER BY ${order} LIMIT $1`, [limit]);
  return rows.map(norm);
}

export async function listAllOpen(): Promise<ProjectCardData[]> {
  const rows = await query(`${CARD_SELECT} WHERE p.status='open' ORDER BY p.sort_order, p.ends_at`);
  return rows.map(norm);
}

export async function getProjectBySlug(slug: string, { includeHidden = false } = {}) {
  const p = await one<Project>(
    `SELECT p.*, s.name AS seller_name FROM projects p LEFT JOIN sellers s ON s.id=p.seller_id WHERE p.slug=$1`,
    [slug],
  );
  if (!p) return null;
  if (!includeHidden && !["scheduled", "open", "judging", "succeeded", "failed"].includes(p.status)) return null;
  return norm(p);
}

export async function getProjectById(id: number) {
  const p = await one<Project>(
    `SELECT p.*, s.name AS seller_name FROM projects p LEFT JOIN sellers s ON s.id=p.seller_id WHERE p.id=$1`,
    [id],
  );
  return p ? norm(p) : null;
}

export async function getUnlocks(projectId: number): Promise<Unlock[]> {
  const rows = await query<Unlock>("SELECT * FROM unlocks WHERE project_id=$1 ORDER BY target_qty", [projectId]);
  return rows.map(normalizeUnlock);
}

export async function getVariants(projectId: number, activeOnly = true): Promise<Variant[]> {
  const rows = await query<Variant>(
    `SELECT * FROM variants WHERE project_id=$1 ${activeOnly ? "AND is_active" : ""} ORDER BY sort_order, id`,
    [projectId],
  );
  return rows.map((v) => ({ ...v, id: Number(v.id), project_id: Number(v.project_id) }));
}

export async function getImages(projectId: number): Promise<{ id: number; url: string }[]> {
  const rows = await query("SELECT id, url FROM project_images WHERE project_id=$1 ORDER BY sort_order, id", [projectId]);
  return rows.map((r) => ({ id: Number(r.id), url: r.url }));
}

/** 参加者数（ユニークユーザー） */
export async function participantCount(projectId: number) {
  const r = await one<{ n: number }>(
    "SELECT COUNT(DISTINCT user_id)::int AS n FROM orders WHERE project_id=$1 AND status IN ('applied','awaiting_payment','payment_failed','paid')",
    [projectId],
  );
  return r?.n ?? 0;
}
