import Link from "next/link";
import { Flash } from "@/components/Flash";
import { LockIcon } from "@/components/LockIcon";
import { ProgressBar } from "@/components/ProgressBar";
import { ProjectImage } from "@/components/ProjectImage";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { progressOf } from "@/lib/unlock";
import { FULFILLMENT_LABEL, ORDER_STATUS_LABEL, PROJECT_STATUS_LABEL, type OrderStatus, type ProjectStatus } from "@/lib/types";
import { fmtDate, num, remainingLabel, yen } from "@/lib/util";

export const dynamic = "force-dynamic";
export const metadata = { title: "マイページ" };

const STATUS_STYLE: Partial<Record<OrderStatus, string>> = {
  applied: "bg-gray-100 text-gray-600",
  awaiting_payment: "bg-gray-100 text-gray-600",
  payment_failed: "bg-red-600 text-white",
  paid: "bg-unlock-100 text-unlock-700",
};

export default async function MyPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser("/mypage");
  const orders = await query(
    `SELECT o.*, p.slug, p.title, p.main_image, p.status AS project_status, p.ends_at, p.total_qty, p.final_qty,
            COALESCE(ARRAY(SELECT target_qty FROM unlocks u WHERE u.project_id=p.id ORDER BY target_qty), '{}') AS targets,
            COALESCE(ARRAY(SELECT title FROM unlocks u WHERE u.project_id=p.id ORDER BY target_qty), '{}') AS titles
       FROM orders o JOIN projects p ON p.id=o.project_id
      WHERE o.user_id=$1 ORDER BY o.created_at DESC LIMIT 100`,
    [user.id],
  );
  const needsAction = orders.filter((o) => o.status === "payment_failed");
  const groups: [string, typeof orders][] = [
    ["参加中", orders.filter((o) => o.status === "applied")],
    ["成立済み", orders.filter((o) => ["awaiting_payment", "payment_failed", "paid", "refunded"].includes(o.status))],
    ["終了・キャンセル", orders.filter((o) => ["cancelled", "void"].includes(o.status))],
  ];
  return (
    <div className="space-y-8">
      <Flash ok={sp.ok} error={sp.error} />
      {needsAction.length > 0 && (
        <div className="notice-error">
          <p className="font-bold">お支払い方法の更新が必要な注文があります</p>
          {needsAction.map((o) => <Link key={o.id} href={`/mypage/orders/${o.id}`} className="block underline">{o.number}：{o.title}</Link>)}
        </div>
      )}
      {orders.length === 0 && (
        <div className="card p-8 text-center text-sm">
          <p className="mb-4 text-ink-soft">まだ申込はありません。</p>
          <Link href="/projects" className="btn-cta">プロジェクトを探す</Link>
        </div>
      )}
      {groups.map(([label, list]) =>
        list.length ? (
          <section key={label}>
            <h2 className="section-title">{label}<span className="text-xs font-normal text-ink-soft">{list.length}件</span></h2>
            <div className="space-y-3">
              {list.map((o) => {
                const total = o.final_qty ?? o.total_qty;
                const prog = progressOf(o.targets.map((t: number, i: number) => ({ target_qty: t, title: o.titles[i] })), total);
                return (
                  <Link key={o.id} href={`/mypage/orders/${o.id}`} className="card flex gap-4 p-4 transition hover:shadow-md">
                    <ProjectImage src={o.main_image} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`chip ${STATUS_STYLE[o.status as OrderStatus] ?? "bg-white border border-line text-ink-soft"}`}>{ORDER_STATUS_LABEL[o.status as OrderStatus]}</span>
                        {o.fulfillment_status !== "none" && <span className="chip bg-gray-50 text-ink">{FULFILLMENT_LABEL[o.fulfillment_status]}</span>}
                        <span className="text-[11px] text-ink-soft">{o.number}・{fmtDate(o.created_at)}</span>
                      </div>
                      <p className="truncate text-sm font-bold">{o.title}</p>
                      <p className="text-xs text-ink-soft">{num(o.quantity)}個・{yen(o.amount)}・{PROJECT_STATUS_LABEL[o.project_status as ProjectStatus]}{o.project_status === "open" ? `（${remainingLabel(o.ends_at)}）` : ""}</p>
                      {o.status === "applied" && (
                        <div className="space-y-1">
                          <ProgressBar total={total} targets={o.targets} compact />
                          <p className="flex items-center gap-1 text-[11px] text-ink-soft">
                            <LockIcon open className="h-3.5 w-3.5 text-unlock" />
                            {prog.achievedCount}/{prog.count} UNLOCKED・{num(total)}個
                            {prog.next && <>・次まであと<b className="text-brand-700">{num(prog.remaining)}個</b></>}
                          </p>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null,
      )}
    </div>
  );
}
