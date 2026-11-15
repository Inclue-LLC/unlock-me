import Link from "next/link";
import { ProjectCard } from "@/components/ProjectCard";
import { LockIcon } from "@/components/LockIcon";
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
      <section className="relative overflow-hidden bg-gradient-to-br from-lavender via-lavender-50 to-pink">
        <div className="container-app py-14 sm:py-20">
          <p className="chip mb-4 bg-white/70 text-lavender-700"><LockIcon open className="h-3.5 w-3.5" /> UNLOCK · SHARE · CREATE</p>
          <h1 className="text-3xl font-black leading-tight sm:text-5xl">
            みんなで、<br />欲しいものを<span className="text-pink-700">解放</span>する。
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-soft">
            購入申込が目標数量に届くと商品化が決定。さらに申込が増えると、限定特典が次々とUNLOCKされます。
            SNSでシェアして、仲間と一緒にまだない商品を実現しよう。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/projects" className="btn-primary">プロジェクトを見る</Link>
            <Link href="/guide" className="btn-outline">UNLOCK MEとは？</Link>
          </div>
        </div>
      </section>

      <div className="container-app space-y-12 py-10">
        {(sp.ok || sp.error) && <div><Flash ok={sp.ok} error={sp.error} /></div>}
        {empty && <p className="card p-8 text-center text-sm text-ink-soft">現在募集中のプロジェクトはありません。</p>}
        {SECTIONS.map((s, i) =>
          data[i].length ? (
            <section key={s.key}>
              <div className="mb-4 flex items-end justify-between">
                <h2 className="text-xl font-black">
                  <span className="mr-2 block text-[11px] tracking-[0.2em] text-pink-500">{s.sub}</span>
                  {s.title}
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
  const steps = [
    ["見つける", "気になるキャラクター・クリエイターの商品を探す"],
    ["申し込む", "購入を申込。決済は商品化が成立してから"],
    ["シェアする", "SNSで共有して参加者を増やす"],
    ["UNLOCK!", "目標達成で商品化決定、さらに特典が解放"],
    ["届く", "みんなで実現した商品がお手元に"],
  ];
  return (
    <section className="card p-6 sm:p-8">
      <h2 className="section-title">UNLOCK MEのしくみ</h2>
      <ol className="grid gap-4 sm:grid-cols-5">
        {steps.map(([t, d], i) => (
          <li key={t} className="rounded-2xl bg-lavender-50 p-4">
            <span className="text-[11px] font-black text-pink-500">STEP {i + 1}</span>
            <p className="mt-1 font-bold">{t}</p>
            <p className="mt-1 text-xs text-ink-soft">{d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
