import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Countdown } from "@/components/Countdown";
import { LockIcon } from "@/components/LockIcon";
import { ProgressBar } from "@/components/ProgressBar";
import { ProjectImage } from "@/components/ProjectImage";
import { ShareButtons } from "@/components/ShareButtons";
import { UnlockList } from "@/components/UnlockList";
import { getCurrentUser } from "@/lib/auth";
import { getImages, getProjectBySlug, getUnlocks, getVariants, participantCount } from "@/lib/projects";
import { getUserActiveQty } from "@/lib/orders";
import { pool } from "@/lib/db";
import { progressOf } from "@/lib/unlock";
import { PROJECT_STATUS_LABEL } from "@/lib/types";
import { appUrl, fmtDateTime, num, yen } from "@/lib/util";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProjectBySlug(slug);
  if (!p) return {};
  const title = p.ogp_title || p.title;
  const description = p.ogp_description || p.description.slice(0, 110);
  const image = p.ogp_image || p.main_image;
  return {
    title: p.title,
    description,
    openGraph: { title, description, url: appUrl(`/projects/${p.slug}`), images: image ? [{ url: image }] : undefined },
    twitter: { card: "summary_large_image", title, description, images: image ? [image] : undefined },
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const p = await getProjectBySlug(slug);
  if (!p) notFound();
  const [unlocks, images, variants, participants, user] = await Promise.all([
    getUnlocks(p.id), getImages(p.id), getVariants(p.id), participantCount(p.id), getCurrentUser(),
  ]);
  const mine = user ? await getUserActiveQty(pool, p.id, user.id) : 0;
  const final = p.final_qty !== null;
  const total = final ? p.final_qty! : p.total_qty;
  const prog = progressOf(unlocks, total);
  const now = new Date();
  const isOpen = p.status === "open" && now >= p.starts_at && now < p.ends_at;
  const url = appUrl(`/projects/${p.slug}`);
  const shareText = prog.next
    ? `「${p.title}」次のUNLOCKまであと${num(prog.remaining)}個！一緒にUNLOCKしよう🔓`
    : `「${p.title}」に参加中！🔓`;
  const gallery = [p.main_image, ...images.map((i) => i.url)].filter(Boolean);

  return (
    <div className="container-app py-6 sm:py-10">
      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr] md:gap-10">
        {/* 画像 */}
        <div className="space-y-3">
          <div className="card overflow-hidden">
            <ProjectImage src={gallery[0] ?? ""} alt={p.title} className="aspect-square w-full object-cover" />
          </div>
          {gallery.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {gallery.slice(1, 9).map((g) => (
                <a key={g} href={g} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl border border-line bg-white">
                  <ProjectImage src={g} alt="" className="aspect-square w-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* 概要・購入 */}
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <span className={`chip ${isOpen ? "bg-ink text-white" : "bg-white text-ink-soft border border-line"}`}>{PROJECT_STATUS_LABEL[p.status]}</span>
            </div>
            <h1 className="text-2xl font-bold leading-snug sm:text-3xl">{p.title}</h1>
            {p.seller_name && <p className="mt-1 text-xs text-ink-soft">by {p.seller_name}</p>}
            <p className="mt-3 font-latin text-3xl font-semibold tabular-nums">{yen(p.price)}<span className="ml-1 font-sans text-sm font-medium text-ink-soft">税込</span></p>
          </div>

          <div className="card space-y-4 p-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm font-bold text-ink-soft">{final ? "最終申込数" : "申込数"}</p>
                <p className="font-latin text-4xl font-semibold tabular-nums">{num(total)}<span className="ml-1 font-sans text-base font-bold">個</span></p>
              </div>
              <div className="text-right text-xs text-ink-soft">
                <p>参加者 <b className="text-ink">{num(participants)}</b>人</p>
                {p.status === "open" && <p className="mt-1">残り <b className="text-base text-ink"><Countdown endsAt={p.ends_at.toISOString()} /></b></p>}
              </div>
            </div>
            <ProgressBar total={total} targets={unlocks.map((u) => u.target_qty)} />
            {p.status === "open" && (
              prog.next ? (
                <div className="vault relative overflow-hidden rounded-2xl p-4">
                  <span className="absolute right-0 top-0 rounded-bl-xl badge-new px-3 py-1 font-latin text-[10px] font-semibold tracking-widest">NEXT UNLOCK</span>
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/70 text-ink-soft ring-1 ring-white">
                      <LockIcon open={false} className="h-7 w-7" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black tracking-widest text-ink-soft">UNLOCK {String(prog.achievedCount + 1).padStart(2, "0")}</p>
                      <p className="truncate font-bold">{prog.next.title}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-right text-sm text-ink-soft">
                    解放まで <b className="text-3xl font-black tabular-nums text-pink-700">あと{num(prog.remaining)}</b><span className="text-ink">個</span>
                  </p>
                </div>
              ) : unlocks.length > 0 ? (
                <div className="unlocked-glow flex items-center gap-3 rounded-2xl p-4 font-black text-pink-700">
                  <LockIcon open className="h-7 w-7" /> すべてのUNLOCKを達成しました！
                </div>
              ) : null
            )}
            {p.status === "succeeded" && <p className="notice-ok">商品化が成立しました！（最終 {num(total)}個）</p>}
            {p.status === "failed" && <p className="notice-error">目標数量に届かず、不成立となりました。申込は取り消され、代金は請求されません。</p>}
            {p.status === "judging" && <p className="notice-info">募集は終了しました。現在、成立判定を行っています。</p>}
            {p.status === "scheduled" && <p className="notice-info">{fmtDateTime(p.starts_at)} から募集開始予定です。</p>}

            {isOpen ? (
              user && mine >= p.max_per_user ? (
                <p className="notice-info">お一人様の上限（{p.max_per_user}個）まで申込済みです。</p>
              ) : (
                <Link href={`/projects/${p.slug}/apply`} className="btn-cta w-full py-4 text-base">
                  <LockIcon open className="h-5 w-5" /> 購入を申し込んでUNLOCKに参加
                </Link>
              )
            ) : null}
            {mine > 0 && <p className="text-center text-xs text-ink-soft">あなたは {mine}個 申込済みです（<Link href="/mypage" className="underline">マイページ</Link>）</p>}

            <ul className="space-y-1 rounded-xl bg-cream p-4 text-[11px] leading-relaxed text-ink-soft">
              <li>・本商品は<b>条件付き商品化</b>です。募集終了時に申込数量が {num(prog.minTarget)}個 に達した場合のみ商品化されます。</li>
              <li>・<b>決済</b>は申込時には行わず、成立後に登録済みのお支払い方法で行います。不成立の場合、代金は請求されません。</li>
              <li>・<b>発送</b>予定：{p.ship_estimate || "成立後にご案内します"}</li>
              <li>・<b>キャンセル</b>：{p.allow_cancel ? "募集期間中はマイページからキャンセルできます。募集終了後はキャンセルできません。" : "申込後のキャンセルはお受けできません。"}</li>
              <li>・特典は{p.reward_unit === "per_item" ? "購入商品1個につき" : "1注文につき"}各1点。達成した特典はすべて付与されます（累積）。販売価格は変わりません。</li>
              <li>・お一人様 {p.max_per_user}個まで／1回の申込 {p.max_per_order}個まで</li>
            </ul>
          </div>

          <div className="card p-5">
            <p className="mb-4 text-center text-xs font-bold text-ink-soft">シェアしてUNLOCKを近づけよう</p>
            <ShareButtons url={url} text={shareText} image={p.ogp_image || p.main_image || undefined} />
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-[1.1fr_1fr] md:gap-10">
        <section>
          <h2 className="section-title">商品について</h2>
          <div className="card whitespace-pre-wrap p-5 text-sm leading-relaxed">{p.description || "—"}</div>
          {variants.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-bold">バリエーション</h3>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => <span key={v.id} className="chip border border-line bg-white text-ink">{v.name}</span>)}
              </div>
            </div>
          )}
          {p.notes && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-bold">注意事項</h3>
              <div className="card whitespace-pre-wrap p-5 text-xs leading-relaxed text-ink-soft">{p.notes}</div>
            </div>
          )}
          <dl className="mt-6 grid grid-cols-[7rem_1fr] gap-y-2 text-xs">
            <dt className="text-ink-soft">募集期間</dt><dd>{fmtDateTime(p.starts_at)} 〜 {fmtDateTime(p.ends_at)}</dd>
            <dt className="text-ink-soft">発送予定</dt><dd>{p.ship_estimate || "—"}</dd>
          </dl>
        </section>
        <section>
          <h2 className="section-title">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-50 text-pink-700"><LockIcon open={prog.achievedCount > 0} className="h-4.5 w-4.5" /></span>
            UNLOCK条件<span className="text-sm font-bold text-pink-700">{prog.achievedCount}/{prog.count} 解放</span>
          </h2>
          {unlocks.length === 0 ? (
            <p className="text-sm text-ink-soft">UNLOCK条件は未設定です。</p>
          ) : (
            <UnlockList
              projectId={p.id}
              total={total}
              final={final}
              unlocks={unlocks.map((u, i) => ({
                id: u.id, index: i + 1, target_qty: u.target_qty, title: u.title, description: u.description,
                image: u.image, achieved: u.achieved_at !== null, confirmed: u.confirmed,
              }))}
            />
          )}
          <p className="mt-3 text-[11px] text-ink-soft">
            ※目標数量は購入者数ではなく申込商品の個数で集計します。募集期間中の達成表示は暫定で、最終的なUNLOCK内容は募集終了後の有効申込数量で確定します。
          </p>
        </section>
      </div>
    </div>
  );
}
