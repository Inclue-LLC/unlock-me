"use server";
import { z } from "zod";
import { act, str } from "@/lib/action";
import {
  closeAndJudge, createProject, deleteUnlock, projectSchema, publishProject, resumeProject, saveUnlock, saveVariant,
  setFulfillment, suspendProject, unlockSchema, unpublishProject, updateProject,
} from "@/lib/admin-projects";
import { audit, type Actor } from "@/lib/audit";
import { destroyAllSessions, requireAdmin } from "@/lib/auth";
import { one, query, tx } from "@/lib/db";
import { deliverQueued, kickDelivery, notify } from "@/lib/mail";
import { DEFAULT_TEMPLATES } from "@/lib/mail/templates";
import { cancelOrderByAdmin } from "@/lib/orders";
import { chargeOrder, tick } from "@/lib/settlement";
import { saveImage } from "@/lib/storage";
import { fromLocalInput, UserError } from "@/lib/util";

async function admin(): Promise<Actor> {
  const u = await requireAdmin();
  return { id: u.id, label: u.email };
}

function parseProject(fd: FormData) {
  const date = (k: string) => {
    try {
      return fromLocalInput(str(fd, k));
    } catch {
      throw new UserError(`${k === "starts_at" ? "開始" : "終了"}日時を入力してください`);
    }
  };
  return projectSchema.parse({
    title: str(fd, "title"),
    slug: str(fd, "slug"),
    description: String(fd.get("description") ?? ""),
    category: str(fd, "category"),
    seller_id: str(fd, "seller_id") ? Number(str(fd, "seller_id")) : null,
    price: str(fd, "price"),
    max_per_order: str(fd, "max_per_order"),
    max_per_user: str(fd, "max_per_user"),
    starts_at: date("starts_at"),
    ends_at: date("ends_at"),
    ship_estimate: str(fd, "ship_estimate"),
    notes: String(fd.get("notes") ?? ""),
    ogp_title: str(fd, "ogp_title"),
    ogp_description: str(fd, "ogp_description"),
    reward_unit: str(fd, "reward_unit"),
    allow_cancel: fd.get("allow_cancel") === "on",
    payment_retry_days: str(fd, "payment_retry_days"),
    is_featured: fd.get("is_featured") === "on",
    sort_order: str(fd, "sort_order") || "0",
  });
}

// ───────── プロジェクト ─────────
export async function createProjectAction(fd: FormData) {
  const actor = await admin();
  await act("/admin/projects/new", async () => {
    const input = parseProject(fd);
    const main = await saveImage(fd.get("main_image_file"));
    const ogp = await saveImage(fd.get("ogp_image_file"));
    const id = await createProject(actor, input, { main_image: main, ogp_image: ogp });
    return `/admin/projects/${id}`;
  }, "プロジェクトを作成しました。UNLOCK条件を登録してから公開してください。");
}

export async function updateProjectAction(fd: FormData) {
  const actor = await admin();
  const id = Number(str(fd, "id"));
  await act(`/admin/projects/${id}`, async () => {
    const input = parseProject(fd);
    const main = await saveImage(fd.get("main_image_file"));
    const ogp = await saveImage(fd.get("ogp_image_file"));
    await updateProject(actor, id, input, { main_image: main, ogp_image: ogp }, str(fd, "reason"));
  }, "保存しました");
}

export async function addImagesAction(fd: FormData) {
  const actor = await admin();
  const id = Number(str(fd, "id"));
  await act(`/admin/projects/${id}#images`, async () => {
    const files = fd.getAll("files");
    let n = 0;
    for (const f of files) {
      const url = await saveImage(f);
      if (url) {
        await query("INSERT INTO project_images (project_id, url, sort_order) VALUES ($1,$2,(SELECT COALESCE(MAX(sort_order),0)+1 FROM project_images WHERE project_id=$1))", [id, url]);
        n++;
      }
    }
    if (!n) throw new UserError("画像を選択してください");
    await audit(actor, "project.images_add", "project", id, { count: n });
  }, "画像を追加しました");
}

export async function deleteImageAction(fd: FormData) {
  const actor = await admin();
  const id = Number(str(fd, "id"));
  await act(`/admin/projects/${id}#images`, async () => {
    await query("DELETE FROM project_images WHERE id=$1 AND project_id=$2", [Number(str(fd, "image_id")), id]);
    await audit(actor, "project.image_delete", "project", id, { imageId: str(fd, "image_id") });
  });
}

export async function saveUnlockAction(fd: FormData) {
  const actor = await admin();
  const id = Number(str(fd, "id"));
  await act(`/admin/projects/${id}#unlocks`, async () => {
    const input = unlockSchema.parse({ target_qty: str(fd, "target_qty"), title: str(fd, "title"), description: String(fd.get("description") ?? "") });
    const image = await saveImage(fd.get("image_file"));
    await saveUnlock(actor, id, str(fd, "unlock_id") ? Number(str(fd, "unlock_id")) : null, input, image, str(fd, "reason"));
  }, "UNLOCK条件を保存しました");
}

export async function deleteUnlockAction(fd: FormData) {
  const actor = await admin();
  const id = Number(str(fd, "id"));
  await act(`/admin/projects/${id}#unlocks`, async () => {
    await deleteUnlock(actor, id, Number(str(fd, "unlock_id")), str(fd, "reason"));
  }, "UNLOCK条件を削除しました");
}

export async function saveVariantAction(fd: FormData) {
  const actor = await admin();
  const id = Number(str(fd, "id"));
  await act(`/admin/projects/${id}#variants`, async () => {
    await saveVariant(actor, id, str(fd, "variant_id") ? Number(str(fd, "variant_id")) : null, str(fd, "name"), str(fd, "sku"), Number(str(fd, "sort_order") || 0), fd.get("is_active") === "on");
  }, "バリエーションを保存しました");
}

export async function projectStateAction(fd: FormData) {
  const actor = await admin();
  const id = Number(str(fd, "id"));
  const op = str(fd, "op");
  await act(`/admin/projects/${id}`, async () => {
    switch (op) {
      case "publish": await publishProject(actor, id); break;
      case "unpublish": await unpublishProject(actor, id); break;
      case "suspend": await suspendProject(actor, id, str(fd, "reason")); break;
      case "resume": await resumeProject(actor, id); break;
      case "close": await closeAndJudge(actor, id); break;
      case "manufacturing": case "preparing": case "shipping": case "completed":
        await setFulfillment(actor, id, op); break;
      default: throw new UserError("不明な操作です");
    }
  }, "更新しました");
}

// ───────── 注文 ─────────
export async function adminCancelOrderAction(fd: FormData) {
  const actor = await admin();
  const id = Number(str(fd, "id"));
  await act(`/admin/orders/${id}`, async () => {
    const reason = str(fd, "reason");
    if (!reason) throw new UserError("取消理由を入力してください");
    await cancelOrderByAdmin(actor, id, reason);
    kickDelivery();
  }, "注文を取り消しました");
}

export async function adminRetryChargeAction(fd: FormData) {
  const actor = await admin();
  const id = Number(str(fd, "id"));
  await act(`/admin/orders/${id}`, async () => {
    const r = await chargeOrder(id, { offSession: true });
    await audit(actor, "payment.admin_retry", "order", id, { result: r.status });
    if (r.status === "failed") throw new UserError(`決済に失敗しました：${r.message ?? ""}`);
    if (r.status === "skipped") throw new UserError("決済対象の状態ではありません");
    if (r.status === "requires_action") throw new UserError("お客様による追加認証が必要です");
  }, "決済が完了しました");
}

export async function adminExtendPaymentDueAction(fd: FormData) {
  const actor = await admin();
  const id = Number(str(fd, "id"));
  await act(`/admin/orders/${id}`, async () => {
    const days = z.coerce.number().int().min(1).max(30).parse(str(fd, "days"));
    const r = await query("UPDATE orders SET payment_due_at = GREATEST(payment_due_at, now()) + make_interval(days => $2), updated_at=now() WHERE id=$1 AND status='payment_failed' RETURNING payment_due_at", [id, days]);
    if (!r.length) throw new UserError("決済失敗の注文のみ延長できます");
    await audit(actor, "order.extend_due", "order", id, { days });
  }, "再決済期限を延長しました");
}

const SHIP_STATUSES = ["none", "manufacturing", "preparing", "shipped", "delivered"] as const;

export async function updateShippingAction(fd: FormData) {
  const actor = await admin();
  const id = Number(str(fd, "id"));
  await act(`/admin/orders/${id}`, async () => {
    const status = z.enum(SHIP_STATUSES).parse(str(fd, "fulfillment_status"));
    await setOrderShipping(actor, id, status, str(fd, "carrier"), str(fd, "tracking_number"));
    kickDelivery();
  }, "配送情報を更新しました");
}

async function setOrderShipping(actor: Actor, id: number, status: (typeof SHIP_STATUSES)[number], carrier: string, tracking: string) {
  await tx(async (c) => {
    const o = await one<any>(
      `SELECT o.*, u.email, u.name AS user_name, p.title AS project_title FROM orders o JOIN users u ON u.id=o.user_id
         JOIN projects p ON p.id=o.project_id WHERE o.id=$1 FOR UPDATE OF o`,
      [id],
      c,
    );
    if (!o) throw new UserError("注文が見つかりません");
    if (o.status !== "paid" && status !== "none") throw new UserError("決済済みの注文のみ配送状況を更新できます");
    if (status === "shipped" && (!carrier || !tracking)) throw new UserError("発送済みにするには配送会社と追跡番号が必要です");
    await query(
      `UPDATE orders SET fulfillment_status=$2, carrier=$3, tracking_number=$4,
              shipped_at = CASE WHEN $2 IN ('shipped','delivered') THEN COALESCE(shipped_at, now()) ELSE shipped_at END, updated_at=now()
        WHERE id=$1`,
      [id, status, carrier, tracking],
      c,
    );
    if (status === "shipped") {
      await notify({
        eventKey: `shipped:${id}`, userId: Number(o.user_id), to: o.email, template: "shipped",
        vars: { name: o.user_name || "お客", orderNumber: o.number, orderId: o.id, projectTitle: o.project_title, carrier, trackingNumber: tracking },
      }, c);
    }
    await audit(actor, "order.shipping", "order", id, { status, carrier, tracking }, c);
  });
}

/** 追跡番号CSV一括取込：申込番号,配送会社,追跡番号 */
export async function importTrackingAction(fd: FormData) {
  const actor = await admin();
  await act("/admin/shipping", async () => {
    const file = fd.get("file");
    const text = file && typeof file !== "string" && file.size > 0 ? await file.text() : String(fd.get("text") ?? "");
    const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    let ok = 0;
    const errors: string[] = [];
    for (const [i, line] of lines.entries()) {
      const [number, carrier, tracking] = line.split(",").map((s) => s.replace(/^"|"$/g, "").trim());
      if (i === 0 && !/^UM\d+$/.test(number)) continue; // ヘッダー行
      const o = await one<{ id: string }>("SELECT id FROM orders WHERE number=$1", [number]);
      if (!o) { errors.push(`${i + 1}行目: 申込番号 ${number} が見つかりません`); continue; }
      try {
        await setOrderShipping(actor, Number(o.id), "shipped", carrier ?? "", tracking ?? "");
        ok++;
      } catch (e) {
        errors.push(`${i + 1}行目: ${(e as Error).message}`);
      }
    }
    kickDelivery();
    if (ok === 0 && errors.length === 0) throw new UserError("取り込むデータがありません");
    if (errors.length) throw new UserError(`${ok}件を取り込みました。エラー ${errors.length}件：${errors.slice(0, 5).join(" / ")}`);
  }, "追跡番号を取り込み、発送完了メールを送信しました");
}

// ───────── ユーザー・出品者 ─────────
export async function userStatusAction(fd: FormData) {
  const actor = await admin();
  const id = Number(str(fd, "id"));
  await act(`/admin/users/${id}`, async () => {
    const status = z.enum(["active", "suspended"]).parse(str(fd, "status"));
    if (id === actor.id) throw new UserError("自分自身は変更できません");
    await query("UPDATE users SET status=$2, updated_at=now() WHERE id=$1 AND status<>'withdrawn'", [id, status]);
    if (status === "suspended") await destroyAllSessions(id);
    await audit(actor, `user.${status === "suspended" ? "suspend" : "activate"}`, "user", id, { reason: str(fd, "reason") });
  }, "更新しました");
}

export async function userRoleAction(fd: FormData) {
  const actor = await admin();
  const id = Number(str(fd, "id"));
  await act(`/admin/users/${id}`, async () => {
    const role = z.enum(["user", "admin"]).parse(str(fd, "role"));
    if (id === actor.id) throw new UserError("自分自身の権限は変更できません");
    await query("UPDATE users SET role=$2, updated_at=now() WHERE id=$1", [id, role]);
    await audit(actor, "user.role", "user", id, { role });
  }, "権限を変更しました");
}

export async function saveSellerAction(fd: FormData) {
  const actor = await admin();
  await act("/admin/sellers", async () => {
    const name = z.string().trim().min(1, "出品者名を入力してください").max(80).parse(str(fd, "name"));
    const id = str(fd, "seller_id");
    const status = str(fd, "status") === "suspended" ? "suspended" : "active";
    if (id) await query("UPDATE sellers SET name=$2, description=$3, status=$4 WHERE id=$1", [Number(id), name, str(fd, "description"), status]);
    else await query("INSERT INTO sellers (name, description) VALUES ($1,$2)", [name, str(fd, "description")]);
    await audit(actor, id ? "seller.update" : "seller.create", "seller", id || name, { name, status });
  }, "保存しました");
}

// ───────── 通知 ─────────
export async function saveTemplateAction(fd: FormData) {
  const actor = await admin();
  const key = str(fd, "key");
  await act(`/admin/notifications/templates/${key}`, async () => {
    const def = DEFAULT_TEMPLATES.find((t) => t.key === key);
    if (!def) throw new UserError("テンプレートが見つかりません");
    const subject = z.string().trim().min(1).max(200).parse(str(fd, "subject"));
    const body = z.string().min(1).max(10000).parse(String(fd.get("body") ?? ""));
    await query(
      `INSERT INTO email_templates (key, name, subject, body) VALUES ($1,$2,$3,$4)
       ON CONFLICT (key) DO UPDATE SET subject=$3, body=$4, updated_at=now()`,
      [key, def.name, subject, body],
    );
    await audit(actor, "template.update", "email_template", key, { subject });
  }, "テンプレートを保存しました");
}

export async function resetTemplateAction(fd: FormData) {
  const actor = await admin();
  const key = str(fd, "key");
  await act(`/admin/notifications/templates/${key}`, async () => {
    await query("DELETE FROM email_templates WHERE key=$1", [key]);
    await audit(actor, "template.reset", "email_template", key);
  }, "初期値に戻しました");
}

export async function resendNotificationAction(fd: FormData) {
  const actor = await admin();
  await act("/admin/notifications", async () => {
    const id = Number(str(fd, "nid"));
    await query("UPDATE notifications SET status='queued', error='' WHERE id=$1 AND status IN ('failed','sent')", [id]);
    await audit(actor, "notification.resend", "notification", id);
    await deliverQueued(20);
  }, "再送しました");
}

export async function runTickAction() {
  const actor = await admin();
  await act("/admin", async () => {
    const r = await tick();
    await audit(actor, "system.tick", "system", "tick", r);
  }, "定期処理を実行しました");
}
