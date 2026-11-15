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
      <div className="relative aspect-square overflow-hidden bg-lavender-50">
        <ProjectImage src={p.main_image} alt={p.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <span className={`chip absolute right-2 top-2 shadow-sm ${open ? "bg-white text-ink" : "bg-ink/80 text-white"}`}>
          {open ? remainingLabel(p.ends_at) : p.status === "succeeded" ? "商品化成立" : p.status === "failed" ? "不成立" : "募集終了"}
        </span>
        {/* 段階ごとの錠：開いた数がひと目でわかる */}
        {prog.count > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-ink/85 px-2 py-1 backdrop-blur">
            {p.targets.map((t) => (
              <LockIcon key={t} open={t <= total} className={`h-4 w-4 ${t <= total ? "text-pink" : "text-white/40"}`} />
            ))}
            <span className="ml-0.5 text-[10px] font-black text-white">{prog.achievedCount}/{prog.count}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        {p.category && <p className="text-[11px] font-bold text-lavender-700">{p.category}</p>}
        <h3 className="line-clamp-2 min-h-[2.6em] text-sm font-bold leading-snug">{p.title}</h3>
        <p className="text-base font-black">{yen(p.price)}<span className="ml-1 text-[10px] font-normal text-ink-soft">税込</span></p>
        <ProgressBar total={total} targets={p.targets} compact />
        <p className="text-[11px] text-ink-soft">
          <b className="text-base font-black text-ink tabular-nums">{num(total)}</b> 個{final ? "で終了" : "申込"}
        </p>
      </div>

      {/* 次のUNLOCK */}
      {open && prog.next ? (
        <div className="vault flex items-center gap-2 px-3 py-2.5 text-[11px] sm:px-4">
          <LockIcon open={false} className="h-4 w-4 shrink-0 text-lavender" />
          <span className="truncate text-white/80">NEXT UNLOCK</span>
          <b className="ml-auto whitespace-nowrap text-sm tabular-nums text-white">あと{num(prog.remaining)}個</b>
        </div>
      ) : allUnlocked || p.status === "succeeded" ? (
        <div className="flex items-center gap-2 bg-pink-600 px-3 py-2.5 text-[11px] font-black text-white sm:px-4">
          <LockIcon open className="h-4 w-4" />
          {allUnlocked ? "ALL UNLOCKED!" : "商品化 UNLOCKED"}
        </div>
      ) : (
        <div className="bg-ink/5 px-3 py-2.5 text-[11px] text-ink-soft sm:px-4">{p.status === "failed" ? "目標未達で終了" : " "}</div>
      )}
    </Link>
  );
}
