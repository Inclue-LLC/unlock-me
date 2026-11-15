export type ProjectStatus = "draft" | "scheduled" | "open" | "judging" | "succeeded" | "failed" | "suspended";
export type OrderStatus = "applied" | "cancelled" | "void" | "awaiting_payment" | "payment_failed" | "paid" | "refunded";
export type RewardUnit = "per_order" | "per_item";

export interface User {
  id: number;
  email: string;
  name: string;
  role: "user" | "admin";
  status: "active" | "suspended" | "withdrawn";
  email_verified_at: Date | null;
  notify_marketing: boolean;
  notify_progress: boolean;
  payment_customer_id: string | null;
}

export interface Project {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: string;
  seller_id: number | null;
  seller_name?: string | null;
  price: number;
  max_per_order: number;
  max_per_user: number;
  starts_at: Date;
  ends_at: Date;
  ship_estimate: string;
  notes: string;
  main_image: string;
  ogp_image: string;
  ogp_title: string;
  ogp_description: string;
  status: ProjectStatus;
  fulfillment_status: string;
  reward_unit: RewardUnit;
  allow_cancel: boolean;
  payment_retry_days: number;
  is_featured: boolean;
  sort_order: number;
  total_qty: number;
  final_qty: number | null;
  published_at: Date | null;
  judged_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Unlock {
  id: number;
  project_id: number;
  target_qty: number;
  title: string;
  description: string;
  image: string;
  kind: "productization" | "reward";
  achieved_at: Date | null;
  confirmed: boolean | null;
}

export interface Variant {
  id: number;
  project_id: number;
  name: string;
  sku: string;
  sort_order: number;
  is_active: boolean;
}

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  draft: "下書き",
  scheduled: "公開予定",
  open: "募集中",
  judging: "募集終了・成立判定中",
  succeeded: "成立",
  failed: "不成立",
  suspended: "停止",
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  applied: "申込中",
  cancelled: "キャンセル済み",
  void: "不成立のため取消",
  awaiting_payment: "成立・決済待ち",
  payment_failed: "決済失敗（再決済待ち）",
  paid: "注文確定",
  refunded: "返金済み",
};

export const FULFILLMENT_LABEL: Record<string, string> = {
  none: "—",
  manufacturing: "製造中",
  preparing: "発送準備中",
  shipping: "発送中",
  shipped: "発送済み",
  delivered: "配達完了",
  completed: "発送完了",
};

/** 数量にカウントされる（有効な）注文ステータス */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = ["applied", "awaiting_payment", "payment_failed", "paid"];
