/**
 * 運営によるプロジェクト管理。
 * 公開後の「購入判断に関わる変更」（価格・特典付与単位・UNLOCK条件・募集終了日時の短縮など）は
 * 原則制限し、例外変更には理由の入力を必須として操作履歴に残す。
 */
import { z } from "zod";
import { one, query, tx } from "./db";
import { audit, type Actor } from "./audit";
import { kickDelivery, notify } from "./mail";
import { recomputeTotal, reevaluateUnlocks } from "./unlock";
import { judgeProject } from "./settlement";
import type { Project } from "./types";
import { appUrl, UserError } from "./util";

export const projectSchema = z
  .object({
    title: z.string().trim().min(1, "商品名を入力してください").max(120),
    slug: z.string().trim().regex(/^[a-z0-9][a-z0-9-]{1,62}$/, "URL名は半角英小文字・数字・ハイフン（2〜63文字）で入力してください"),
    description: z.string().max(10000).default(""),
    category: z.string().trim().max(40).default(""),
    seller_id: z.coerce.number().int().positive().nullable(),
    price: z.coerce.number().int("価格は整数で入力してください").min(0).max(10_000_000),
    max_per_order: z.coerce.number().int().min(1).max(1000),
    max_per_user: z.coerce.number().int().min(1).max(10000),
    starts_at: z.date(),
    ends_at: z.date(),
    ship_estimate: z.string().trim().max(100).default(""),
    notes: z.string().max(5000).default(""),
    ogp_title: z.string().trim().max(120).default(""),
    ogp_description: z.string().trim().max(300).default(""),
    reward_unit: z.enum(["per_order", "per_item"]),
    allow_cancel: z.boolean(),
    payment_retry_days: z.coerce.number().int().min(0).max(60),
    is_featured: z.boolean(),
    sort_order: z.coerce.number().int().min(-100000).max(100000),
  })
  .refine((v) => v.ends_at > v.starts_at, { message: "終了日時は開始日時より後にしてください" });

export type ProjectInput = z.infer<typeof projectSchema>;

/** 公開後に変更する場合に例外変更理由が必要な項目 */
const SENSITIVE: (keyof ProjectInput)[] = ["price", "reward_unit", "allow_cancel", "starts_at", "ends_at", "max_per_order", "max_per_user", "payment_retry_days"];

function same(a: unknown, b: unknown) {
  if (a instanceof Date || b instanceof Date) return new Date(a as Date).getTime() === new Date(b as Date).getTime();
  return String(a ?? "") === String(b ?? "");
}

export async function createProject(actor: Actor, input: ProjectInput, images: { main_image?: string | null; ogp_image?: string | null }) {
  return tx(async (c) => {
    const dup = await one("SELECT 1 FROM projects WHERE slug=$1", [input.slug], c);
    if (dup) throw new UserError("このURL名は既に使われています");
    const r = await one<{ id: string }>(
      `INSERT INTO projects (title, slug, description, category, seller_id, price, max_per_order, max_per_user, starts_at, ends_at,
         ship_estimate, notes, ogp_title, ogp_description, reward_unit, allow_cancel, payment_retry_days, is_featured, sort_order,
         main_image, ogp_image)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING id`,
      [input.title, input.slug, input.description, input.category, input.seller_id, input.price, input.max_per_order, input.max_per_user,
        input.starts_at, input.ends_at, input.ship_estimate, input.notes, input.ogp_title, input.ogp_description, input.reward_unit,
        input.allow_cancel, input.payment_retry_days, input.is_featured, input.sort_order, images.main_image ?? "", images.ogp_image ?? ""],
      c,
    );
    await audit(actor, "project.create", "project", r!.id, { title: input.title }, c);
    return Number(r!.id);
  });
}

export async function updateProject(
  actor: Actor,
  id: number,
  input: ProjectInput,
  images: { main_image?: string | null; ogp_image?: string | null },
  reason: string,
) {
  await tx(async (c) => {
    const p = await one<Project>("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [id], c);
    if (!p) throw new UserError("プロジェクトが見つかりません");
    if (["succeeded", "failed", "judging"].includes(p.status) && (SENSITIVE.some((k) => !same(p[k as keyof Project], input[k])))) {
      throw new UserError("成立判定後は価格・期間・条件を変更できません");
    }
    const dup = await one("SELECT 1 FROM projects WHERE slug=$1 AND id<>$2", [input.slug, id], c);
    if (dup) throw new UserError("このURL名は既に使われています");
    const changed: Record<string, { from: unknown; to: unknown }> = {};
    for (const k of Object.keys(input) as (keyof ProjectInput)[]) {
      if (!same(p[k as keyof Project], input[k])) changed[k] = { from: p[k as keyof Project], to: input[k] };
    }
    const sensitive = Object.keys(changed).filter((k) => SENSITIVE.includes(k as keyof ProjectInput));
    const published = p.status !== "draft";
    if (published && sensitive.length && !reason.trim()) {
      throw new UserError(`公開後に「${sensitive.join(", ")}」を変更するには例外変更理由の入力が必要です`);
    }
    if (published && changed.ends_at && input.ends_at < new Date()) {
      throw new UserError("募集終了日時を過去にすることはできません（早期終了は「募集を終了して成立判定」を使用してください）");
    }
    await query(
      `UPDATE projects SET title=$2, slug=$3, description=$4, category=$5, seller_id=$6, price=$7, max_per_order=$8, max_per_user=$9,
         starts_at=$10, ends_at=$11, ship_estimate=$12, notes=$13, ogp_title=$14, ogp_description=$15, reward_unit=$16, allow_cancel=$17,
         payment_retry_days=$18, is_featured=$19, sort_order=$20,
         main_image=COALESCE($21, main_image), ogp_image=COALESCE($22, ogp_image), updated_at=now()
       WHERE id=$1`,
      [id, input.title, input.slug, input.description, input.category, input.seller_id, input.price, input.max_per_order, input.max_per_user,
        input.starts_at, input.ends_at, input.ship_estimate, input.notes, input.ogp_title, input.ogp_description, input.reward_unit,
        input.allow_cancel, input.payment_retry_days, input.is_featured, input.sort_order, images.main_image ?? null, images.ogp_image ?? null],
      c,
    );
    if (images.main_image) changed.main_image = { from: p.main_image, to: images.main_image };
    if (images.ogp_image) changed.ogp_image = { from: p.ogp_image, to: images.ogp_image };
    if (Object.keys(changed).length) {
      await audit(actor, published && sensitive.length ? "project.exception_change" : "project.update", "project", id, { changed, reason }, c);
    }
    if (published && sensitive.length) await notifyParticipantsOfChange(c, { ...p, title: input.title, slug: input.slug }, reason);
  });
}

// ───────── UNLOCK条件 ─────────
export const unlockSchema = z.object({
  target_qty: z.coerce.number().int("目標数量は整数で入力してください").min(1, "目標数量は1以上にしてください").max(10_000_000),
  title: z.string().trim().min(1, "UNLOCK内容を入力してください").max(100),
  description: z.string().max(2000).default(""),
});

async function lockEditable(c: any, projectId: number, reason: string) {
  const p = await one<Project>("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [projectId], c);
  if (!p) throw new UserError("プロジェクトが見つかりません");
  if (["succeeded", "failed", "judging"].includes(p.status)) throw new UserError("募集終了後はUNLOCK条件を変更できません");
  const published = p.status !== "draft";
  if (published && !reason.trim()) throw new UserError("公開後のUNLOCK条件変更には例外変更理由の入力が必要です");
  return { p, published };
}

export async function saveUnlock(actor: Actor, projectId: number, unlockId: number | null, input: z.infer<typeof unlockSchema>, image: string | null, reason: string) {
  await tx(async (c) => {
    const { p, published } = await lockEditable(c, projectId, reason);
    const dup = await one("SELECT 1 FROM unlocks WHERE project_id=$1 AND target_qty=$2 AND ($3::bigint IS NULL OR id<>$3)", [projectId, input.target_qty, unlockId], c);
    if (dup) throw new UserError("同じ目標数量のUNLOCK条件が既にあります");
    let before: any = null;
    if (unlockId) {
      before = await one("SELECT * FROM unlocks WHERE id=$1 AND project_id=$2", [unlockId, projectId], c);
      if (!before) throw new UserError("UNLOCK条件が見つかりません");
      await query(
        "UPDATE unlocks SET target_qty=$3, title=$4, description=$5, image=COALESCE($6, image) WHERE id=$1 AND project_id=$2",
        [unlockId, projectId, input.target_qty, input.title, input.description, image],
        c,
      );
    } else {
      await query("INSERT INTO unlocks (project_id, target_qty, title, description, image) VALUES ($1,$2,$3,$4,$5)", [
        projectId, input.target_qty, input.title, input.description, image ?? "",
      ], c);
    }
    await normalizeKinds(c, projectId);
    if (p.status === "open" || p.status === "suspended") await reevaluateUnlocks(c, projectId, await recomputeTotal(c, projectId));
    await audit(actor, published ? "unlock.exception_change" : unlockId ? "unlock.update" : "unlock.create", "project", projectId, {
      unlockId, before: before && { target_qty: before.target_qty, title: before.title, description: before.description }, after: input, reason,
    }, c);
    if (published) await notifyParticipantsOfChange(c, p, reason);
  });
  kickDelivery();
}

export async function deleteUnlock(actor: Actor, projectId: number, unlockId: number, reason: string) {
  await tx(async (c) => {
    const { p, published } = await lockEditable(c, projectId, reason);
    const cnt = await one<{ n: number }>("SELECT COUNT(*)::int n FROM unlocks WHERE project_id=$1", [projectId], c);
    if (published && (cnt?.n ?? 0) <= 1) throw new UserError("公開中のプロジェクトはUNLOCK条件を0件にできません");
    const before = await one("DELETE FROM unlocks WHERE id=$1 AND project_id=$2 RETURNING *", [unlockId, projectId], c);
    if (!before) throw new UserError("UNLOCK条件が見つかりません");
    await normalizeKinds(c, projectId);
    await audit(actor, published ? "unlock.exception_delete" : "unlock.delete", "project", projectId, { before, reason }, c);
    if (published) await notifyParticipantsOfChange(c, p, reason);
  });
  kickDelivery();
}

/** 最小目標の条件を「商品化」、それ以外を「特典」とする */
async function normalizeKinds(c: any, projectId: number) {
  await query(
    `UPDATE unlocks SET kind = CASE WHEN target_qty = (SELECT MIN(target_qty) FROM unlocks WHERE project_id=$1) THEN 'productization' ELSE 'reward' END
      WHERE project_id=$1`,
    [projectId],
    c,
  );
}

async function notifyParticipantsOfChange(c: any, p: Project, reason: string) {
  const users = await query(
    `SELECT DISTINCT u.id, u.email, u.name FROM orders o JOIN users u ON u.id=o.user_id
      WHERE o.project_id=$1 AND o.status='applied' AND u.status='active'`,
    [p.id],
    c,
  );
  const stamp = Date.now();
  for (const u of users) {
    await notify({
      eventKey: `condition_change:${p.id}:${stamp}:${u.id}`, userId: Number(u.id), to: u.email, template: "condition_changed",
      vars: { name: u.name || "お客", projectTitle: p.title, reason, projectUrl: appUrl(`/projects/${p.slug}`) },
    }, c);
  }
}

// ───────── バリエーション ─────────
export async function saveVariant(actor: Actor, projectId: number, variantId: number | null, name: string, sku: string, sortOrder: number, active: boolean) {
  if (!name.trim()) throw new UserError("バリエーション名を入力してください");
  await tx(async (c) => {
    const p = await one<Project>("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [projectId], c);
    if (!p) throw new UserError("プロジェクトが見つかりません");
    if (variantId) {
      await query("UPDATE variants SET name=$3, sku=$4, sort_order=$5, is_active=$6 WHERE id=$1 AND project_id=$2", [variantId, projectId, name.trim(), sku.trim(), sortOrder, active], c);
    } else {
      const orders = await one("SELECT 1 FROM orders WHERE project_id=$1 LIMIT 1", [projectId], c);
      const hasVariants = await one("SELECT 1 FROM variants WHERE project_id=$1 LIMIT 1", [projectId], c);
      if (orders && !hasVariants) throw new UserError("バリエーションなしで申込を受け付けたプロジェクトにはバリエーションを追加できません");
      await query("INSERT INTO variants (project_id, name, sku, sort_order, is_active) VALUES ($1,$2,$3,$4,$5)", [projectId, name.trim(), sku.trim(), sortOrder, active], c);
    }
    await audit(actor, variantId ? "variant.update" : "variant.create", "project", projectId, { variantId, name, sku, active }, c);
  });
}

// ───────── 状態遷移 ─────────
export async function publishProject(actor: Actor, id: number) {
  await tx(async (c) => {
    const p = await one<Project>("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [id], c);
    if (!p) throw new UserError("プロジェクトが見つかりません");
    if (p.status !== "draft") throw new UserError("下書きのプロジェクトのみ公開できます");
    const u = await one<{ n: number }>("SELECT COUNT(*)::int n FROM unlocks WHERE project_id=$1", [id], c);
    if (!u?.n) throw new UserError("UNLOCK条件を1件以上登録してください");
    if (p.ends_at <= new Date()) throw new UserError("募集終了日時が過ぎています");
    const status = p.starts_at <= new Date() ? "open" : "scheduled";
    await query("UPDATE projects SET status=$2, published_at=now(), updated_at=now() WHERE id=$1", [id, status], c);
    await audit(actor, "project.publish", "project", id, { status }, c);
  });
}

export async function unpublishProject(actor: Actor, id: number) {
  await tx(async (c) => {
    const p = await one<Project>("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [id], c);
    if (!p || !["scheduled", "open", "suspended"].includes(p.status)) throw new UserError("下書きに戻せない状態です");
    const o = await one("SELECT 1 FROM orders WHERE project_id=$1 LIMIT 1", [id], c);
    if (o) throw new UserError("申込があるプロジェクトは下書きに戻せません（停止を使用してください）");
    await query("UPDATE projects SET status='draft', updated_at=now() WHERE id=$1", [id], c);
    await audit(actor, "project.unpublish", "project", id, {}, c);
  });
}

export async function suspendProject(actor: Actor, id: number, reason: string) {
  const r = await query("UPDATE projects SET status='suspended', updated_at=now() WHERE id=$1 AND status IN ('open','scheduled') RETURNING id", [id]);
  if (!r.length) throw new UserError("停止できない状態です");
  await audit(actor, "project.suspend", "project", id, { reason });
}

export async function resumeProject(actor: Actor, id: number) {
  const r = await query(
    "UPDATE projects SET status = CASE WHEN starts_at <= now() THEN 'open' ELSE 'scheduled' END, updated_at=now() WHERE id=$1 AND status='suspended' AND ends_at > now() RETURNING id",
    [id],
  );
  if (!r.length) throw new UserError("再開できない状態です（募集終了日時を過ぎている場合は期間を延長してください）");
  await audit(actor, "project.resume", "project", id);
}

/** 募集を終了して成立判定（停止中プロジェクトの終了や早期終了に使用） */
export async function closeAndJudge(actor: Actor, id: number) {
  await tx(async (c) => {
    const p = await one<Project>("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [id], c);
    if (!p || !["open", "suspended"].includes(p.status)) throw new UserError("募集中または停止中のプロジェクトのみ終了できます");
    await query("UPDATE projects SET status='judging', ends_at=LEAST(ends_at, now()), updated_at=now() WHERE id=$1", [id], c);
    await audit(actor, "project.close", "project", id, { originalEndsAt: p.ends_at }, c);
  });
  return judgeProject(id, actor, { force: true });
}

/** 履行状態の一括更新（成立プロジェクトの決済済み注文） */
export async function setFulfillment(actor: Actor, id: number, status: "manufacturing" | "preparing" | "shipping" | "completed") {
  const map: Record<string, string> = { manufacturing: "manufacturing", preparing: "preparing" };
  await tx(async (c) => {
    const p = await one<Project>("SELECT * FROM projects WHERE id=$1 FOR UPDATE", [id], c);
    if (!p || p.status !== "succeeded") throw new UserError("成立したプロジェクトのみ変更できます");
    await query("UPDATE projects SET fulfillment_status=$2, updated_at=now() WHERE id=$1", [id, status], c);
    if (map[status]) {
      await query(
        "UPDATE orders SET fulfillment_status=$2, updated_at=now() WHERE project_id=$1 AND status='paid' AND fulfillment_status IN ('none','manufacturing','preparing')",
        [id, map[status]],
        c,
      );
    }
    await audit(actor, "project.fulfillment", "project", id, { status }, c);
  });
}
