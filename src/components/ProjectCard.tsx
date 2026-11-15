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
  return (
    <Link href={`/projects/${p.slug}`} className="card group block overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-lavender-50">
        <ProjectImage src={p.main_image} alt={p.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1">
          {prog.achievedCount > 0 && (
            <span className="chip bg-white/90 text-pink-700 shadow-sm">
              <LockIcon open className="h-3.5 w-3.5" /> {prog.achievedCount}/{prog.count} UNLOCKED
            </span>
          )}
        </div>
        <span className={`chip absolute right-3 top-3 shadow-sm ${open ? "bg-ink text-white" : "bg-white/90 text-ink-soft"}`}>
          {open ? remainingLabel(p.ends_at) : "募集終了"}
        </span>
      </div>
      <div className="space-y-2 p-4">
        {p.category && <p className="text-[11px] font-bold text-lavender-700">{p.category}</p>}
        <h3 className="line-clamp-2 min-h-[2.6em] text-sm font-bold leading-snug">{p.title}</h3>
        <p className="text-base font-black">{yen(p.price)}<span className="ml-1 text-[10px] font-normal text-ink-soft">税込</span></p>
        <ProgressBar total={total} targets={p.targets} compact />
        <p className="leading-none">
          <span className="text-lg font-black text-pink-700">{num(total)}</span>
          <span className="ml-0.5 text-[11px] text-ink-soft">個 {final ? "で終了" : "申込"}</span>
        </p>
        <p className="text-[11px] text-ink-soft">
          {open && prog.next ? (
            <>次のUNLOCKまで <b className="text-ink">あと{num(prog.remaining)}個</b></>
          ) : open && prog.count > 0 ? (
            <b className="text-pink-700">ALL UNLOCKED!</b>
          ) : p.status === "succeeded" ? (
            <b className="text-pink-700">商品化成立</b>
          ) : p.status === "failed" ? "不成立" : "\u00a0"}
        </p>
      </div>
    </Link>
  );
}
