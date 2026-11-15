import Link from "next/link";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { query } from "@/lib/db";
import { DEFAULT_TEMPLATES } from "@/lib/mail/templates";
import { clampInt, fmtDateTime } from "@/lib/util";
import { resendNotificationAction } from "../actions";
import { PageTitle, Pager } from "../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "通知" };
const PER = 50;

export default async function Notifications({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const page = clampInt(sp.page, 1, 10000, 1);
  const [custom, rows] = await Promise.all([
    query("SELECT key, updated_at FROM email_templates"),
    query("SELECT * FROM notifications WHERE ($1='' OR status=$1) ORDER BY id DESC LIMIT $2 OFFSET $3", [sp.status ?? "", PER + 1, (page - 1) * PER]),
  ]);
  const customized = new Map(custom.map((c) => [c.key, c.updated_at]));
  return (
    <div className="space-y-8">
      <PageTitle>通知</PageTitle>
      <Flash ok={sp.ok} error={sp.error} />
      <section>
        <h2 className="section-title">メールテンプレート</h2>
        <div className="grid gap-2 md:grid-cols-3">
          {DEFAULT_TEMPLATES.map((t) => (
            <Link key={t.key} href={`/admin/notifications/templates/${t.key}`} className="card p-4 text-sm hover:shadow-md">
              <p className="font-bold">{t.name}</p>
              <p className="text-xs text-ink-soft">{customized.has(t.key) ? `編集済み ${fmtDateTime(customized.get(t.key))}` : "初期値"}</p>
            </Link>
          ))}
        </div>
      </section>
      <section>
        <h2 className="section-title">送信履歴</h2>
        <div className="mb-3 flex gap-2 text-xs">
          {["", "queued", "sent", "failed"].map((s) => <Link key={s} href={`/admin/notifications${s ? `?status=${s}` : ""}`} className="btn-outline btn-sm">{s || "すべて"}</Link>)}
        </div>
        <div className="card overflow-x-auto">
          <table className="table">
            <thead><tr><th>ID</th><th>宛先</th><th>件名</th><th>状態</th><th>作成</th><th>送信</th><th></th></tr></thead>
            <tbody>
              {rows.slice(0, PER).map((n) => (
                <tr key={n.id}>
                  <td>{n.id}</td><td className="text-xs">{n.to_email}</td>
                  <td className="max-w-md"><details><summary className="cursor-pointer">{n.subject}</summary><pre className="mt-2 whitespace-pre-wrap text-[11px]">{n.body}</pre></details></td>
                  <td>{n.status}{n.error && <p className="text-[10px] text-pink-700">{n.error}</p>}</td>
                  <td className="whitespace-nowrap text-xs">{fmtDateTime(n.created_at)}</td>
                  <td className="whitespace-nowrap text-xs">{fmtDateTime(n.sent_at)}</td>
                  <td>{n.status !== "queued" && <form action={resendNotificationAction}><input type="hidden" name="nid" value={n.id} /><SubmitButton className="btn-outline btn-sm">再送</SubmitButton></form>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} hasNext={rows.length > PER} base={`/admin/notifications${sp.status ? `?status=${sp.status}` : ""}`} />
      </section>
    </div>
  );
}
