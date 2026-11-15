import { notFound } from "next/navigation";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { one } from "@/lib/db";
import { DEFAULT_TEMPLATES } from "@/lib/mail/templates";
import { resetTemplateAction, saveTemplateAction } from "../../../actions";
import { PageTitle } from "../../../ui";

export const dynamic = "force-dynamic";

export default async function TemplateEdit({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string>> }) {
  const { key } = await params;
  const sp = await searchParams;
  const def = DEFAULT_TEMPLATES.find((t) => t.key === key);
  if (!def) notFound();
  const row = await one("SELECT subject, body FROM email_templates WHERE key=$1", [key]);
  const vars = [...new Set([...(def.subject + def.body).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
  return (
    <div className="space-y-4">
      <PageTitle>{def.name}</PageTitle>
      <Flash ok={sp.ok} error={sp.error} />
      <p className="text-xs text-ink-soft">使用できる変数：{vars.map((v) => <code key={v} className="mr-2 rounded bg-[#F7F7F7] px-1">{`{{${v}}}`}</code>)}</p>
      <form action={saveTemplateAction} className="card space-y-3 p-5">
        <input type="hidden" name="key" value={key} />
        <div><label className="label">件名</label><input name="subject" defaultValue={row?.subject ?? def.subject} className="input" /></div>
        <div><label className="label">本文</label><textarea name="body" rows={22} defaultValue={row?.body ?? def.body} className="input font-mono text-xs" /></div>
        <SubmitButton className="btn-primary btn-sm">保存</SubmitButton>
      </form>
      {row && <form action={resetTemplateAction}><input type="hidden" name="key" value={key} /><SubmitButton className="btn-outline btn-sm" confirm="初期値に戻しますか？">初期値に戻す</SubmitButton></form>}
    </div>
  );
}
