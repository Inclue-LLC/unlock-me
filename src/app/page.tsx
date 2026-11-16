import Link from "next/link";
import { ProjectCard } from "@/components/ProjectCard";
import { HeroLock, LockIcon, ProductizedBadge } from "@/components/LockIcon";
import { listAllOpen, listSection } from "@/lib/projects";
import { Flash } from "@/components/Flash";
import { ProjectImage } from "@/components/ProjectImage";
import { ProjectProgress } from "@/components/ProjectProgress";
import type { ProjectCardData } from "@/lib/projects";
import { yen } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  // トップは「注目のプロジェクト」「もうすぐUNLOCK」「すべてのプロジェクト」の3つだけ
  const [featured, soon, all] = await Promise.all([listSection("featured", 1), listSection("soon", 6), listAllOpen()]);
  const spotlight = featured[0] ?? soon[0] ?? all[0] ?? null;
  const sections: { key: string; title: string; sub: string; items: ProjectCardData[]; more?: boolean }[] = [
    { key: "soon", title: "もうすぐUNLOCK", sub: "Almost there", items: soon.filter((p) => p.id !== spotlight?.id) },
    { key: "all", title: "すべてのプロジェクト", sub: "All projects", items: all, more: true },
  ];
  const empty = all.length === 0;
  return (
    <>
      <section className="relative overflow-hidden bg-[linear-gradient(160deg,#F2ECFA,#FBEAF0_60%,#FFFAF8)]">
        <div className="container-app relative grid items-center gap-6 py-12 sm:grid-cols-[1.3fr_1fr] sm:py-16">
          <div>
            <p className="eyebrow mb-3">Unlock · Share · Create</p>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
              みんなで、<br />
              <span className="whitespace-nowrap">欲しいものを</span>
              <br className="sm:hidden" />
              <span className="whitespace-nowrap"><span className="text-pink-700">解放</span>する。</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-soft">
              申込が目標数量に届くと<b className="text-ink">商品化がUNLOCK</b>。
              さらに増えると<b className="text-ink">限定特典</b>が次々とUNLOCKされます。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/projects" className="btn-cta">
                <LockIcon open className="h-4 w-4" /> プロジェクトを見る
              </Link>
              <Link href="/guide" className="btn-outline">UNLOCK MEとは？</Link>
            </div>
          </div>
          <HeroLock className="animate-float order-first mx-auto w-28 sm:order-none sm:w-56" />
        </div>
      </section>

      <div className="container-app space-y-14 py-12">
        {(sp.ok || sp.error) && <div><Flash ok={sp.ok} error={sp.error} /></div>}
        {empty && <p className="card p-8 text-center text-sm text-ink-soft">現在募集中のプロジェクトはありません。</p>}
        {spotlight && <Spotlight p={spotlight} />}
        {sections.map((s) =>
          s.items.length ? (
            <section key={s.key}>
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <p className="eyebrow flex items-center gap-1.5"><LockIcon open={false} className="h-3.5 w-3.5" />{s.sub}</p>
                  <h2 className="mt-1 text-xl font-bold sm:text-2xl">{s.title}</h2>
                </div>
                {s.more && <Link href="/projects" className="text-xs font-bold text-ink-soft">一覧で見る →</Link>}
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {s.items.map((p) => <ProjectCard key={p.id} p={p} />)}
              </div>
            </section>
          ) : null,
        )}
        <HowItWorks />
      </div>
    </>
  );
}

function HowItWorks() {
  const steps: [string, string][] = [
    ["見つける", "気になるキャラクター・クリエイターの商品を探す"],
    ["申し込む", "購入を申込。決済は商品化が成立してから"],
    ["シェアする", "SNSで共有して参加者を増やす"],
    ["UNLOCK!", "目標達成で商品化決定、さらに特典が解放"],
    ["届く", "みんなで実現した商品がお手元に"],
  ];
  return (
    <section className="card p-6 sm:p-8">
      <p className="eyebrow">How it works</p>
      <h2 className="mb-5 mt-1 text-xl font-bold sm:text-2xl">UNLOCK MEのしくみ</h2>
      <ol className="grid gap-3 sm:grid-cols-5">
        {steps.map(([t, d], i) => (
          <li key={t} className="unlocked-glow rounded-2xl p-4">
            <span className="flex items-center gap-1.5 font-latin text-[11px] font-semibold tracking-[0.12em] text-pink-700">
              <LockIcon open className="h-4 w-4" /> STEP {i + 1}
            </span>
            <p className="mt-1 font-bold">{t}</p>
            <p className="mt-1 text-xs text-ink-soft">{d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** 注目プロジェクト：商品ページと同じ「画像＋商品名・値段＋進捗カード」の構成 */
function Spotlight({ p }: { p: ProjectCardData }) {
  const final = p.final_qty !== null;
  const total = final ? p.final_qty! : p.total_qty;
  const open = p.status === "open";
  const achieved = p.targets.filter((t) => t <= total).length;
  return (
    <section>
      <p className="eyebrow flex items-center gap-1.5"><LockIcon open={false} className="h-3.5 w-3.5" />Featured</p>
      <h2 className="mb-4 mt-1 text-xl font-bold sm:text-2xl">注目のプロジェクト</h2>
      {/* 画像と情報を1枚のカードにまとめる */}
      <div className="card grid overflow-hidden md:grid-cols-[1.05fr_1fr]">
        <Link href={`/projects/${p.slug}`} className="relative block overflow-hidden bg-mist">
          <ProjectImage src={p.main_image} alt={p.title} className="aspect-square h-full w-full object-cover transition duration-500 hover:scale-105" />
          {(achieved > 0 || p.status === "succeeded") && <span className="absolute left-4 top-4"><ProductizedBadge size="lg" /></span>}
        </Link>
        <div className="flex flex-col p-5 sm:p-7">
          <span className={`chip mb-2 self-start ${open ? "bg-ink text-white" : "border border-line bg-white text-ink-soft"}`}>{open ? "募集中" : "募集終了"}</span>
          <h3 className="text-2xl font-bold leading-snug sm:text-3xl">
            <Link href={`/projects/${p.slug}`} className="hover:underline">{p.title}</Link>
          </h3>
          <p className="mt-3 font-latin text-3xl font-semibold tabular-nums">{yen(p.price)}<span className="ml-1 font-sans text-sm font-medium text-ink-soft">税込</span></p>
          <div className="my-5 border-t border-line" />
          <ProjectProgress total={total} final={final} targets={p.targets} titles={p.unlock_titles} images={p.unlock_images} open={open} endsAt={p.ends_at} />
          {open && (
            <Link href={`/projects/${p.slug}/apply`} className="btn-cta mt-5 w-full py-4 text-base md:mt-auto">
              <LockIcon open className="h-5 w-5" /> このプロジェクトに申し込む
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
