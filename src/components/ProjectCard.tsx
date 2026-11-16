import Link from "next/link";
import type { ProjectCardData } from "@/lib/projects";
import { progressOf } from "@/lib/unlock";
import { num, remainingLabel, yen } from "@/lib/util";
import { LockIcon } from "./LockIcon";
import { ProgressBar } from "./ProgressBar";
import { ProjectImage } from "./ProjectImage";

export function ProjectCard({ p }: { p: ProjectCardData }) {
  const final = p.final_qty !== null;
  const total = final ? p.final_qty! : p.total_qty;
  const prog = progressOf(p.targets.map((t, i) => ({ target_qty: t, title: p.unlock_titles[i] })), total);
  const open = p.status === "open";
  const allUnlocked = prog.count > 0 && !prog.next;

  return (
    <Link href={`/projects/${p.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-mist">
        <ProjectImage src={p.main_image} alt={p.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <span className={`chip absolute right-2 top-2 shadow-sm ${open ? "bg-white text-ink" : "bg-white/90 text-ink-soft"}`}>
          {open ? remainingLabel(p.ends_at) : p.status === "succeeded" ? "商品化成立" : p.status === "failed" ? "不成立" : "募集終了"}
        </span>
        {/* 段階ごとの錠：開いた数がひと目でわかる */}
        {prog.count > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 shadow-sm backdrop-blur">
            {p.targets.map((t) => (
              <LockIcon key={t} open={t <= total} className={`h-4 w-4 ${t <= total ? "text-pink-600" : "text-ink-soft/60"}`} />
            ))}
            <span className="ml-0.5 text-[10px] font-black text-ink">{prog.achievedCount}/{prog.count}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-3 sm:p-4">
        {/* 商品名 */}
        <h3 className="line-clamp-2 min-h-[2.7em] text-[15px] font-bold leading-snug sm:text-base">{p.title}</h3>
        {/* 値段 */}
        <p className="font-latin text-xl font-semibold tabular-nums leading-none sm:text-2xl">
          {yen(p.price)}<span className="ml-1 font-sans text-[11px] font-medium text-ink-soft">税込</span>
        </p>

        <div className="mt-auto space-y-2 pt-1">
          <ProgressBar total={total} targets={p.targets} compact />
          {/* 申込数 */}
          <div className="flex items-baseline justify-between gap-2 rounded-xl bg-mist px-3 py-2">
            <span className="whitespace-nowrap text-[11px] font-bold text-ink-soft sm:text-xs">{final ? "最終申込数" : "申込数"}</span>
            <span className="whitespace-nowrap leading-none">
              <b className="font-latin text-lg font-semibold tabular-nums sm:text-xl">{num(total)}</b>
              <span className="ml-0.5 text-xs font-bold">個</span>
            </span>
          </div>
          {/* 次のUNLOCKまでの個数（終了・全達成時は状態） */}
          {open && prog.next ? (
            <div className="rounded-xl bg-pink-50 px-3 py-2 text-pink-700">
              <p className="flex items-center gap-1 whitespace-nowrap text-[11px] font-bold sm:text-xs">
                <LockIcon open={false} className="h-3.5 w-3.5 shrink-0" />次のUNLOCKまで
              </p>
              <p className="mt-1 whitespace-nowrap text-right leading-none">
                <span className="text-xs font-bold">あと</span>
                <b className="mx-0.5 font-latin text-2xl font-semibold tabular-nums">{num(prog.remaining)}</b>
                <span className="text-xs font-bold">個</span>
              </p>
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold ${allUnlocked || p.status === "succeeded" ? "bg-pink-700 text-white" : "bg-mist text-ink-soft"}`}>
              {(allUnlocked || p.status === "succeeded") && <LockIcon open className="h-4 w-4 shrink-0" />}
              {allUnlocked ? "すべてUNLOCKしました" : p.status === "succeeded" ? "商品化が決定しました" : p.status === "failed" ? "目標未達で終了" : "募集終了"}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
