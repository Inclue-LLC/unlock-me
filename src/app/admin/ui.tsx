import Link from "next/link";
import { ORDER_STATUS_LABEL, PROJECT_STATUS_LABEL, type OrderStatus, type ProjectStatus } from "@/lib/types";

export function PageTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-black">{children}</h1>
      {action}
    </div>
  );
}

const PCOLOR: Record<ProjectStatus, string> = {
  draft: "bg-white border border-line text-ink-soft", scheduled: "bg-gray-100 text-gray-600", open: "bg-brand text-white",
  judging: "bg-amber-100 text-amber-800", succeeded: "bg-unlock-100 text-unlock-700", failed: "bg-red-50 text-red-700", suspended: "bg-red-600 text-white",
};
export function ProjectStatusChip({ s }: { s: ProjectStatus }) {
  return <span className={`chip ${PCOLOR[s]}`}>{PROJECT_STATUS_LABEL[s]}</span>;
}

const OCOLOR: Partial<Record<OrderStatus, string>> = {
  applied: "bg-brand-50 text-brand-700", awaiting_payment: "bg-amber-100 text-amber-800", payment_failed: "bg-red-600 text-white",
  paid: "bg-unlock-100 text-unlock-700",
};
export function OrderStatusChip({ s }: { s: OrderStatus }) {
  return <span className={`chip ${OCOLOR[s] ?? "bg-white border border-line text-ink-soft"}`}>{ORDER_STATUS_LABEL[s]}</span>;
}

export function Pager({ page, hasNext, base }: { page: number; hasNext: boolean; base: string }) {
  const sep = base.includes("?") ? "&" : "?";
  return (
    <div className="mt-4 flex justify-center gap-2 text-xs">
      {page > 1 && <Link className="btn-outline btn-sm" href={`${base}${sep}page=${page - 1}`}>前へ</Link>}
      {hasNext && <Link className="btn-outline btn-sm" href={`${base}${sep}page=${page + 1}`}>次へ</Link>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-bold text-ink-soft">{label}</p>
      <p className="mt-1 text-2xl font-black tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-[11px] text-ink-soft">{sub}</p>}
    </div>
  );
}
