import Link from "next/link";
import { query } from "@/lib/db";
import { clampInt, fmtDateTime } from "@/lib/util";
import { PageTitle, Pager } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "ユーザー" };
const PER = 50;

export default async function Users({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const page = clampInt(sp.page, 1, 10000, 1);
  const rows = await query(
    `SELECT u.*, (SELECT COUNT(*) FROM orders o WHERE o.user_id=u.id)::int AS orders
       FROM users u WHERE ($1 = '' OR u.email ILIKE '%'||$1||'%' OR u.name ILIKE '%'||$1||'%')
      ORDER BY u.id DESC LIMIT $2 OFFSET $3`,
    [sp.q ?? "", PER + 1, (page - 1) * PER],
  );
  return (
    <>
      <PageTitle>ユーザー</PageTitle>
      <form className="mb-4 flex gap-2"><input name="q" defaultValue={sp.q} placeholder="メール・氏名" className="input w-64 py-2" /><button className="btn-outline btn-sm">検索</button></form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>ID</th><th>氏名</th><th>メール</th><th>権限</th><th>状態</th><th>認証</th><th className="text-right">注文</th><th>登録日時</th></tr></thead>
          <tbody>
            {rows.slice(0, PER).map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td><td><Link className="font-bold underline" href={`/admin/users/${u.id}`}>{u.name}</Link></td><td>{u.email}</td>
                <td>{u.role === "admin" ? "管理者" : "会員"}</td>
                <td>{{ active: "有効", suspended: "利用停止", withdrawn: "退会" }[u.status as string]}</td>
                <td>{u.email_verified_at ? "✓" : "—"}</td><td className="text-right">{u.orders}</td>
                <td className="text-xs">{fmtDateTime(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager page={page} hasNext={rows.length > PER} base={`/admin/users${sp.q ? `?q=${encodeURIComponent(sp.q)}` : ""}`} />
    </>
  );
}
