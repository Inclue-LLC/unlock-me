import { getCurrentUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { query } from "@/lib/db";
import { FULFILLMENT_LABEL, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/types";
import { fmtDate, fmtDateTime } from "@/lib/util";

export const dynamic = "force-dynamic";

/**
 * 集計・出力CSV
 *  - orders     : 注文一覧
 *  - shipping   : 製造・発送用（バリエーション・確定特典を含む、決済済みのみ）
 *  - production : 製造数量（バリエーション別・特典別）
 *  - sales      : 売上・精算（プロジェクト別）
 */
export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return new Response("Forbidden", { status: 403 });
  const { type } = await params;
  const url = new URL(req.url);
  const project = url.searchParams.get("project");
  const pid = project && /^\d+$/.test(project) ? Number(project) : null;
  const from = url.searchParams.get("from") || null;
  const to = url.searchParams.get("to") || null;
  let csv: string;
  switch (type) {
    case "orders": {
      const rows = await query(
        `SELECT o.*, p.title, u.email, u.name,
                (SELECT string_agg(COALESCE(NULLIF(variant_name,''),'-') || '×' || quantity, ' / ' ORDER BY id) FROM order_items i WHERE i.order_id=o.id) AS items,
                (SELECT string_agg(title || '×' || quantity, ' / ' ORDER BY target_qty) FROM order_rewards r WHERE r.order_id=o.id) AS rewards
           FROM orders o JOIN projects p ON p.id=o.project_id JOIN users u ON u.id=o.user_id
          WHERE ($1::bigint IS NULL OR o.project_id=$1) AND ($2::date IS NULL OR o.created_at >= $2::date) AND ($3::date IS NULL OR o.created_at < $3::date + 1)
          ORDER BY o.id`,
        [pid, from, to],
      );
      csv = toCsv(
        ["申込番号", "プロジェクトID", "プロジェクト", "会員ID", "氏名", "メール", "内容", "数量", "単価", "金額", "状態", "確定特典", "申込日時", "決済日時", "配送状況", "配送会社", "追跡番号", "取消理由"],
        rows.map((o) => [o.number, o.project_id, o.title, o.user_id, o.name, o.email, o.items, o.quantity, o.unit_price, o.amount,
          ORDER_STATUS_LABEL[o.status as OrderStatus], o.rewards, fmtDateTime(o.created_at), fmtDateTime(o.paid_at),
          FULFILLMENT_LABEL[o.fulfillment_status], o.carrier, o.tracking_number, o.cancel_reason]),
      );
      break;
    }
    case "shipping": {
      const rows = await query(
        `SELECT o.number, o.project_id, p.title, o.shipping_address AS a, i.variant_name, v.sku, i.quantity, o.quantity AS order_qty,
                (SELECT string_agg(title || '×' || quantity, ' / ' ORDER BY target_qty) FROM order_rewards r WHERE r.order_id=o.id) AS rewards,
                o.fulfillment_status, o.carrier, o.tracking_number
           FROM orders o JOIN projects p ON p.id=o.project_id JOIN order_items i ON i.order_id=o.id LEFT JOIN variants v ON v.id=i.variant_id
          WHERE o.status='paid' AND ($1::bigint IS NULL OR o.project_id=$1)
          ORDER BY o.project_id, o.id, i.id`,
        [pid],
      );
      csv = toCsv(
        ["申込番号", "プロジェクトID", "商品名", "バリエーション", "SKU", "数量", "注文合計数量", "確定特典", "お届け先氏名", "郵便番号", "都道府県", "市区町村", "番地", "建物名", "電話番号", "配送状況", "配送会社", "追跡番号"],
        rows.map((r) => [r.number, r.project_id, r.title, r.variant_name, r.sku, r.quantity, r.order_qty, r.rewards, r.a.name, r.a.postal_code,
          r.a.prefecture, r.a.city, r.a.line1, r.a.line2, r.a.phone, FULFILLMENT_LABEL[r.fulfillment_status], r.carrier, r.tracking_number]),
      );
      break;
    }
    case "production": {
      const rows = await query(
        `SELECT p.id, p.title, '商品' AS kind, COALESCE(NULLIF(i.variant_name,''), '（単一）') AS name, COALESCE(v.sku,'') AS sku, SUM(i.quantity)::int AS qty
           FROM orders o JOIN projects p ON p.id=o.project_id JOIN order_items i ON i.order_id=o.id LEFT JOIN variants v ON v.id=i.variant_id
          WHERE o.status='paid' AND ($1::bigint IS NULL OR p.id=$1) GROUP BY p.id, p.title, i.variant_name, v.sku
         UNION ALL
         SELECT p.id, p.title, '特典', r.title, '', SUM(r.quantity)::int
           FROM orders o JOIN projects p ON p.id=o.project_id JOIN order_rewards r ON r.order_id=o.id
          WHERE o.status='paid' AND ($1::bigint IS NULL OR p.id=$1) GROUP BY p.id, p.title, r.title
          ORDER BY 1, 3, 4`,
        [pid],
      );
      csv = toCsv(["プロジェクトID", "プロジェクト", "区分", "品目", "SKU", "製造数量"], rows.map((r) => [r.id, r.title, r.kind, r.name, r.sku, r.qty]));
      break;
    }
    case "sales": {
      const rows = await query(
        `SELECT p.id, p.title, s.name AS seller, p.status, p.final_qty, p.judged_at,
                COUNT(o.*) FILTER (WHERE o.status='paid')::int AS paid_orders,
                COALESCE(SUM(o.quantity) FILTER (WHERE o.status='paid'),0)::int AS paid_qty,
                COALESCE(SUM(o.amount) FILTER (WHERE o.status='paid'),0)::bigint AS sales,
                COALESCE(SUM(o.amount) FILTER (WHERE o.status='refunded'),0)::bigint AS refunded,
                COUNT(o.*) FILTER (WHERE o.status='payment_failed')::int AS failed,
                COUNT(o.*) FILTER (WHERE o.status='cancelled')::int AS cancelled
           FROM projects p LEFT JOIN sellers s ON s.id=p.seller_id LEFT JOIN orders o ON o.project_id=p.id
          WHERE p.status IN ('succeeded','failed','judging') AND ($1::bigint IS NULL OR p.id=$1)
          GROUP BY p.id, s.name ORDER BY p.judged_at NULLS LAST, p.id`,
        [pid],
      );
      csv = toCsv(
        ["プロジェクトID", "プロジェクト", "出品者", "結果", "確定数量", "判定日", "決済済み件数", "決済済み数量", "売上(税込)", "返金額", "決済失敗", "取消"],
        rows.map((r) => [r.id, r.title, r.seller ?? "運営", r.status === "succeeded" ? "成立" : r.status === "failed" ? "不成立" : "判定中",
          r.final_qty, fmtDate(r.judged_at), r.paid_orders, r.paid_qty, r.sales, r.refunded, r.failed, r.cancelled]),
      );
      break;
    }
    default:
      return new Response("Not found", { status: 404 });
  }
  await audit({ id: user.id, label: user.email }, "export.csv", "system", type, { project: pid, from, to });
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="unlockme-${type}${pid ? `-p${pid}` : ""}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
