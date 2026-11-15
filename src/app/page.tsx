import Link from "next/link";
import { ProjectCard } from "@/components/ProjectCard";
import { HeroLock, LockIcon } from "@/components/LockIcon";
import { listSection, type Section } from "@/lib/projects";
import { Flash } from "@/components/Flash";

export const dynamic = "force-dynamic";

const SECTIONS: { key: Section; title: string; sub: string }[] = [
  { key: "featured", title: "おすすめ", sub: "PICK UP" },
  { key: "soon", title: "もうすぐUNLOCK", sub: "ALMOST THERE" },
  { key: "ending", title: "募集終了間近", sub: "LAST CHANCE" },
  { key: "new", title: "新着", sub: "NEW" },
  { key: "unlocked", title: "UNLOCK達成済み", sub: "UNLOCKED" },
];

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const data = await Promise.all(SECTIONS.map((s) => listSection(s.key)));
  const empty = data.every((d) => d.length === 0);
  return (
    <>
      <section className="relative overflow-hidden bg-lavender-50">
        <div className="container-app relative grid items-center gap-6 py-12 sm:grid-cols-[1.3fr_1fr] sm:py-16">
          <div>
            <p className="chip mb-4 bg-white text-lavender-700 shadow-sm"><LockIcon open className="h-3.5 w-3.5" /> UNLOCK · SHARE · CREATE</p>
            <h1 className="text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
              みんなで、<br />
              <span className="whitespace-nowrap">欲しいものを</span>
              <br className="sm:hidden" />
              <span className="whitespace-nowrap"><span className="text-pink-600">解放</span>する。</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-soft">
              申込が目標数量に届くと<b className="text-ink">商品化がUNLOCK</b>。
              さらに増えると<b className="text-ink">限定特典</b>が次々とUNLOCKされます。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/projects" className="btn-pink">
                <LockIcon open className="h-4 w-4" /> プロジェクトを見る
              </Link>
              <Link href="/guide" className="btn-outline">UNLOCK MEとは？</Link>
            </div>
          </div>
          <HeroLock className="animate-float order-first mx-auto w-28 sm:order-none sm:w-56" />
        </div>
      </section>

      <div className="container-app space-y-12 py-10">
        {(sp.ok || sp.error) && <div><Flash ok={sp.ok} error={sp.error} /></div>}
        {empty && <p className="card p-8 text-center text-sm text-ink-soft">現在募集中のプロジェクトはありません。</p>}
        {SECTIONS.map((s, i) =>
          data[i].length ? (
            <section key={s.key}>
              <div className="mb-4 flex items-end justify-between">
                <h2 className="flex items-center gap-2 text-xl font-black">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lavender text-lavender-700">
                    <LockIcon open={s.key === "unlocked"} className="h-4.5 w-4.5" />
                  </span>
                  <span>
                    <span className="block text-[10px] tracking-[0.2em] text-pink-600">{s.sub}</span>
                    {s.title}
                  </span>
                </h2>
                <Link href="/projects" className="text-xs font-bold text-lavender-700">すべて見る →</Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
                {data[i].map((p) => <ProjectCard key={p.id} p={p} />)}
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
  const steps: [string, string, boolean][] = [
    ["見つける", "気になるキャラクター・クリエイターの商品を探す", false],
    ["申し込む", "購入を申込。決済は商品化が成立してから", false],
    ["シェアする", "SNSで共有して参加者を増やす", false],
    ["UNLOCK!", "目標達成で商品化決定、さらに特典が解放", true],
    ["届く", "みんなで実現した商品がお手元に", true],
  ];
  return (
    <section className="card p-6 sm:p-8">
      <h2 className="section-title">UNLOCK MEのしくみ</h2>
      <ol className="grid gap-3 sm:grid-cols-5">
        {steps.map(([t, d, open], i) => (
          <li key={t} className={`rounded-2xl p-4 ${open ? "unlocked-glow" : "vault"}`}>
            <span className={`flex items-center gap-1.5 text-[11px] font-black ${open ? "text-pink-700" : "text-lavender-700"}`}>
              <LockIcon open={open} className="h-4 w-4" /> STEP {i + 1}
            </span>
            <p className={`mt-1 font-black`}>{t}</p>
            <p className={`mt-1 text-xs text-ink-soft`}>{d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
