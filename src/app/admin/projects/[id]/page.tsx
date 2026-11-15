/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash } from "@/components/Flash";
import { LockIcon } from "@/components/LockIcon";
import { ProgressBar } from "@/components/ProgressBar";
import { SubmitButton } from "@/components/SubmitButton";
import { one, query } from "@/lib/db";
import { getImages, getProjectById, getUnlocks, getVariants } from "@/lib/projects";
import { FULFILLMENT_LABEL } from "@/lib/types";
import { fmtDateTime, num, yen } from "@/lib/util";
import {
  addImagesAction, deleteImageAction, deleteUnlockAction, projectStateAction, saveUnlockAction, saveVariantAction, updateProjectAction,
} from "../../actions";
import { PageTitle, ProjectStatusChip } from "../../ui";
import { F, ProjectFields } from "../ProjectForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "プロジェクト編集" };

export default async function EditProject({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^\d+$/.test(id)) notFound();
  const p = await getProjectById(Number(id));
  if (!p) notFound();
  const [unlocks, variants, images, sellersRaw, stats, logs] = await Promise.all([
    getUnlocks(p.id), getVariants(p.id, false), getImages(p.id),
    query("SELECT id, name FROM sellers ORDER BY name"),
    one(`SELECT COUNT(*) FILTER (WHERE status IN ('applied','awaiting_payment','payment_failed','paid'))::int AS active,
                COUNT(*) FILTER (WHERE status='paid')::int AS paid,
                COUNT(*) FILTER (WHERE status='payment_failed')::int AS failed,
                COUNT(*) FILTER (WHERE status='awaiting_payment')::int AS awaiting,
                COALESCE(SUM(amount) FILTER (WHERE status='paid'),0)::bigint AS sales,
                COUNT(DISTINCT user_id) FILTER (WHERE status IN ('applied','awaiting_payment','payment_failed','paid'))::int AS users
           FROM orders WHERE project_id=$1`, [p.id]),
    query("SELECT * FROM audit_logs WHERE entity='project' AND entity_id=$1 ORDER BY id DESC LIMIT 15", [String(p.id)]),
  ]);
  const sellers = sellersRaw.map((s) => ({ id: Number(s.id), name: s.name }));
  const published = p.status !== "draft";
  const locked = ["judging", "succeeded", "failed"].includes(p.status);
  const total = p.final_qty ?? p.total_qty;
  const state = (op: string, label: string, cls = "btn-outline btn-sm", confirm?: string, withReason = false) => (
    <form action={projectStateAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={p.id} />
      <input type="hidden" name="op" value={op} />
      {withReason && <input name="reason" placeholder="理由" className="input py-2 text-xs" />}
      <SubmitButton className={cls} confirm={confirm}>{label}</SubmitButton>
    </form>
  );

  return (
    <div className="space-y-8">
      <PageTitle action={<Link href={`/projects/${p.slug}`} target="_blank" className="btn-outline btn-sm">公開ページを見る ↗</Link>}>
        <span className="mr-2 text-sm text-ink-soft">#{p.id}</span>{p.title}
      </PageTitle>
      <Flash ok={sp.ok} error={sp.error} />

      {/* 状態・操作 */}
      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <ProjectStatusChip s={p.status} />
          {p.fulfillment_status !== "none" && <span className="chip bg-gray-50">履行：{FULFILLMENT_LABEL[p.fulfillment_status]}</span>}
          <span className="text-xs text-ink-soft">公開 {fmtDateTime(p.published_at) || "—"}・判定 {fmtDateTime(p.judged_at) || "—"}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-6">
          <div><p className="text-xs text-ink-soft">{p.final_qty !== null ? "確定数量" : "申込数量"}</p><p className="text-xl font-black">{num(total)}</p></div>
          <div><p className="text-xs text-ink-soft">有効注文</p><p className="text-xl font-black">{num(stats.active)}</p></div>
          <div><p className="text-xs text-ink-soft">参加者</p><p className="text-xl font-black">{num(stats.users)}</p></div>
          <div><p className="text-xs text-ink-soft">決済済み</p><p className="text-xl font-black">{num(stats.paid)}</p></div>
          <div><p className="text-xs text-ink-soft">決済待ち／失敗</p><p className="text-xl font-black">{stats.awaiting}／<span className="text-red-700">{stats.failed}</span></p></div>
          <div><p className="text-xs text-ink-soft">売上</p><p className="text-xl font-black">{yen(stats.sales)}</p></div>
        </div>
        <ProgressBar total={total} targets={unlocks.map((u) => u.target_qty)} />
        <div className="flex flex-wrap gap-2">
          {p.status === "draft" && state("publish", "公開する", "btn-cta btn-sm", "公開しますか？開始日時前の場合は「公開予定」になります。")}
          {["scheduled", "open", "suspended"].includes(p.status) && Number(stats.active) === 0 && state("unpublish", "下書きに戻す")}
          {["scheduled", "open"].includes(p.status) && state("suspend", "停止する", "btn-danger btn-sm", "申込受付を停止しますか？", true)}
          {p.status === "suspended" && state("resume", "再開する", "btn-soft btn-sm")}
          {["open", "suspended"].includes(p.status) && state("close", "募集を終了して成立判定", "btn-danger btn-sm", "今すぐ募集を終了し、成立判定（成立なら課金）を実行します。よろしいですか？")}
          {p.status === "succeeded" && (
            <>
              {state("manufacturing", "製造中にする")}
              {state("preparing", "発送準備中にする")}
              {state("completed", "発送完了にする")}
              <Link href={`/admin/orders?project=${p.id}`} className="btn-outline btn-sm">注文一覧</Link>
              <Link href={`/api/admin/exports/shipping?project=${p.id}`} className="btn-outline btn-sm">製造・発送CSV</Link>
            </>
          )}
        </div>
      </section>

      {/* UNLOCK条件 */}
      <section id="unlocks" className="card space-y-4 p-5">
        <h2 className="section-title"><LockIcon open className="h-5 w-5 text-unlock" />UNLOCK条件</h2>
        <p className="text-xs text-ink-soft">目標数量の昇順で表示されます。最小の目標数量が「商品化（最低成立条件）」、以降が累積の追加特典です。{published && <b className="text-brand-700"> 公開後の変更は例外変更理由が必須で、参加者へ通知されます。</b>}</p>
        {unlocks.map((u, i) => (
          <details key={u.id} className="rounded-2xl border border-line p-4">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
              <b>UNLOCK {String(i + 1).padStart(2, "0")}</b><span>{num(u.target_qty)}個</span><span>{u.title}</span>
              <span className={`chip ${u.achieved_at ? "bg-unlock text-white" : "bg-gray-100 text-gray-600"}`}>{u.achieved_at ? "UNLOCKED" : "LOCKED"}</span>
              {u.confirmed !== null && <span className="chip bg-gray-50">{u.confirmed ? "確定" : "未達確定"}</span>}
              <span className="text-[11px] text-ink-soft">{u.kind === "productization" ? "商品化" : "特典"}</span>
            </summary>
            {!locked && (
              <div className="mt-4 space-y-3">
                <form action={saveUnlockAction} className="grid gap-3 md:grid-cols-[8rem_1fr]">
                  <input type="hidden" name="id" value={p.id} /><input type="hidden" name="unlock_id" value={u.id} />
                  <UnlockFields u={u} published={published} />
                  <div className="md:col-span-2"><SubmitButton className="btn-primary btn-sm">更新</SubmitButton></div>
                </form>
                <form action={deleteUnlockAction} className="flex gap-2">
                  <input type="hidden" name="id" value={p.id} /><input type="hidden" name="unlock_id" value={u.id} />
                  {published && <input name="reason" placeholder="削除理由（必須）" className="input py-2 text-xs" />}
                  <SubmitButton className="btn-danger btn-sm" confirm="このUNLOCK条件を削除しますか？">削除</SubmitButton>
                </form>
              </div>
            )}
          </details>
        ))}
        {!locked && (
          <form action={saveUnlockAction} className="grid gap-3 rounded-2xl bg-gray-50 p-4 md:grid-cols-[8rem_1fr]">
            <p className="text-sm font-bold md:col-span-2">＋ UNLOCK条件を追加</p>
            <input type="hidden" name="id" value={p.id} />
            <UnlockFields published={published} />
            <div className="md:col-span-2"><SubmitButton className="btn-primary btn-sm">追加</SubmitButton></div>
          </form>
        )}
      </section>

      {/* 基本情報 */}
      <section className="card p-5">
        <h2 className="section-title">商品・募集情報</h2>
        <form action={updateProjectAction} className="space-y-6">
          <input type="hidden" name="id" value={p.id} />
          <ProjectFields p={p} sellers={sellers} />
          {published && (
            <F label="例外変更理由（公開後に価格・期間・上限・付与単位・キャンセル可否を変更する場合は必須。参加者へ通知されます）">
              <input name="reason" className="input" />
            </F>
          )}
          <SubmitButton className="btn-primary">保存</SubmitButton>
        </form>
      </section>

      {/* バリエーション */}
      <section id="variants" className="card space-y-3 p-5">
        <h2 className="section-title">バリエーション（カラー・サイズ等）</h2>
        <p className="text-xs text-ink-soft">登録がない場合は単一商品として申込を受け付けます。</p>
        {[...variants, null].map((v) => (
          <form key={v?.id ?? "new"} action={saveVariantAction} className="flex flex-wrap items-end gap-2 rounded-xl border border-line p-3">
            <input type="hidden" name="id" value={p.id} />
            {v && <input type="hidden" name="variant_id" value={v.id} />}
            <F label="名称"><input name="name" defaultValue={v?.name} required className="input py-2" placeholder={v ? "" : "新規：ピンク / M"} /></F>
            <F label="SKU"><input name="sku" defaultValue={v?.sku} className="input w-32 py-2" /></F>
            <F label="表示順"><input name="sort_order" type="number" defaultValue={v?.sort_order ?? 0} className="input w-20 py-2" /></F>
            <label className="mb-3 flex items-center gap-1 text-xs"><input type="checkbox" name="is_active" defaultChecked={v?.is_active ?? true} className="accent-brand" />受付中</label>
            <SubmitButton className={v ? "btn-outline btn-sm" : "btn-primary btn-sm"}>{v ? "更新" : "追加"}</SubmitButton>
          </form>
        ))}
      </section>

      {/* 画像 */}
      <section id="images" className="card space-y-3 p-5">
        <h2 className="section-title">商品画像（複数）</h2>
        <div className="flex flex-wrap gap-3">
          {images.map((img) => (
            <form key={img.id} action={deleteImageAction} className="relative">
              <input type="hidden" name="id" value={p.id} /><input type="hidden" name="image_id" value={img.id} />
              <img src={img.url} alt="" className="h-24 w-24 rounded-xl object-cover" />
              <button className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-ink text-xs text-white" title="削除">×</button>
            </form>
          ))}
        </div>
        <form action={addImagesAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={p.id} />
          <input type="file" name="files" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="text-xs" />
          <SubmitButton className="btn-outline btn-sm">アップロード</SubmitButton>
        </form>
      </section>

      {/* 操作履歴 */}
      <section className="card p-5">
        <h2 className="section-title">操作履歴</h2>
        <ul className="space-y-1 text-xs">
          {logs.map((l) => (
            <li key={l.id} className="flex flex-wrap gap-2">
              <span className="text-ink-soft">{fmtDateTime(l.created_at)}</span><b>{l.action}</b><span>{l.actor_label}</span>
              {l.detail?.reason && <span className="text-amber-700">理由：{l.detail.reason}</span>}
            </li>
          ))}
        </ul>
        <Link href={`/admin/audit?entity=project&id=${p.id}`} className="mt-2 inline-block text-xs underline">すべて見る</Link>
      </section>
    </div>
  );
}

function UnlockFields({ u, published }: { u?: { target_qty: number; title: string; description: string; image: string }; published: boolean }) {
  return (
    <>
      <F label="目標数量（個）"><input name="target_qty" type="number" min={1} required defaultValue={u?.target_qty} className="input py-2" /></F>
      <F label="UNLOCK内容（タイトル）"><input name="title" required maxLength={100} defaultValue={u?.title} className="input py-2" placeholder="限定チャームをプレゼント" /></F>
      <F label="特典画像">
        {u?.image && <img src={u.image} alt="" className="mb-1 h-12 w-12 rounded-lg object-cover" />}
        <input name="image_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="text-xs" />
      </F>
      <F label="説明"><textarea name="description" rows={2} defaultValue={u?.description} className="input py-2" /></F>
      {published && <F label="例外変更理由（必須）" className="md:col-span-2"><input name="reason" className="input py-2" /></F>}
    </>
  );
}
