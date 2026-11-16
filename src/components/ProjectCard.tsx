import Link from "next/link";
import type { ProjectCardData } from "@/lib/projects";
import { progressOf } from "@/lib/unlock";
import { num, remainingLabel, yen } from "@/lib/util";
import { LockIcon, ProductizedBadge } from "./LockIcon";
import { ProgressBar } from "./ProgressBar";
import { ProjectImage } from "./ProjectImage";
import { NextUnlockPanel } from "./ProjectProgress";

/** 商品カード：商品ページと同じ並び（商品名 → 値段 → 申込数 → ロックトラック → 次のUNLOCK） */
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
        {/* 1つでもUNLOCKしたら「商品化成立」マーク */}
        {(prog.achievedCount > 0 || p.status === "succeeded") && (
          <span className="absolute left-2 top-2"><ProductizedBadge /></span>
        )}
        {!open && (
          <span className="chip absolute right-2 top-2 bg-white/90 text-ink-soft shadow-sm">
            {p.status === "failed" ? "不成立" : "募集終了"}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        {/* 商品名・値段 */}
        <h3 className="line-clamp-2 min-h-[2.7em] text-[15px] font-bold leading-snug sm:text-base">{p.title}</h3>
        <p className="mt-1.5 font-latin text-xl font-semibold tabular-nums leading-none sm:text-2xl">
          {yen(p.price)}<span className="ml-1 font-sans text-[11px] font-medium text-ink-soft">税込</span>
        </p>

        {/* 申込数（商品ページと同じ表記） */}
        <div className="mt-4 flex items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold text-ink-soft">{final ? "最終申込数" : "申込数"}</p>
            <p className="font-latin text-2xl font-semibold tabular-nums leading-tight">{num(total)}<span className="ml-0.5 font-sans text-xs font-bold">個</span></p>
          </div>
          {open && <p className="whitespace-nowrap pb-1 text-[11px] font-bold text-ink-soft">{remainingLabel(p.ends_at)}</p>}
        </div>

        <div className="mt-auto pt-3">
          {prog.count > 0 && <ProgressBar total={total} targets={p.targets} size="sm" />}
          {open && prog.next ? (
            <NextUnlockPanel size="sm" index={prog.achievedCount + 1} title={prog.next.title} remaining={prog.remaining} />
          ) : allUnlocked || p.status === "succeeded" ? (
            <div className="unlocked-glow flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold text-pink-700">
              <LockIcon open className="h-4 w-4 shrink-0" />
              {allUnlocked ? "すべてUNLOCKしました" : "商品化が決定しました"}
            </div>
          ) : (
            <div className="rounded-xl bg-mist px-3 py-2.5 text-xs font-bold text-ink-soft">
              {p.status === "failed" ? "目標未達で終了" : "募集終了"}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
