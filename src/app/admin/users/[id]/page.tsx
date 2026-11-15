import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { one, query } from "@/lib/db";
import type { OrderStatus } from "@/lib/types";
import { fmtDateTime, yen } from "@/lib/util";
import { userRoleAction, userStatusAction } from "../../actions";
import { OrderStatusChip, PageTitle } from "../../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "ユーザー詳細" };

export default async function UserDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^\d+$/.test(id)) notFound();
  const u = await one("SELECT * FROM users WHERE id=$1", [id]);
  if (!u) notFound();
  const orders = await query("SELECT o.*, p.title FROM orders o JOIN projects p ON p.id=o.project_id WHERE o.user_id=$1 ORDER BY o.id DESC", [id]);
  return (
    <div className="space-y-6">
      <PageTitle>{u.name}</PageTitle>
      <Flash ok={sp.ok} error={sp.error} />
      <section className="card grid gap-4 p-5 text-sm md:grid-cols-2">
        <dl className="grid grid-cols-[7rem_1fr] gap-y-2">
          <dt className="text-xs text-ink-soft">メール</dt><dd>{u.email}</dd>
          <dt className="text-xs text-ink-soft">メール認証</dt><dd>{u.email_verified_at ? fmtDateTime(u.email_verified_at) : "未認証"}</dd>
          <dt className="text-xs text-ink-soft">状態</dt><dd>{u.status}</dd>
          <dt className="text-xs text-ink-soft">権限</dt><dd>{u.role}</dd>
          <dt className="text-xs text-ink-soft">登録</dt><dd>{fmtDateTime(u.created_at)}</dd>
        </dl>
        {u.status !== "withdrawn" && (
          <div className="space-y-3">
            <form action={userStatusAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={u.id} />
              <input type="hidden" name="status" value={u.status === "active" ? "suspended" : "active"} />
              <input name="reason" placeholder="理由" className="input py-2" />
              <SubmitButton className={u.status === "active" ? "btn-danger btn-sm" : "btn-soft btn-sm"} confirm="変更しますか？">{u.status === "active" ? "利用停止にする" : "利用停止を解除"}</SubmitButton>
            </form>
            <form action={userRoleAction} className="flex gap-2">
              <input type="hidden" name="id" value={u.id} />
              <input type="hidden" name="role" value={u.role === "admin" ? "user" : "admin"} />
              <SubmitButton className="btn-outline btn-sm" confirm="権限を変更しますか？">{u.role === "admin" ? "管理者権限を外す" : "管理者にする"}</SubmitButton>
            </form>
          </div>
        )}
      </section>
      <section className="card overflow-x-auto p-5">
        <h2 className="section-title">注文</h2>
        <table className="table"><tbody>
          {orders.map((o) => (
            <tr key={o.id}><td><Link className="font-mono underline" href={`/admin/orders/${o.id}`}>{o.number}</Link></td><td>{o.title}</td><td>{o.quantity}個</td><td>{yen(o.amount)}</td><td><OrderStatusChip s={o.status as OrderStatus} /></td><td className="text-xs">{fmtDateTime(o.created_at)}</td></tr>
          ))}
        </tbody></table>
      </section>
    </div>
  );
}
