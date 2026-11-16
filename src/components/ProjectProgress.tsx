import { progressOf } from "@/lib/unlock";
import { num } from "@/lib/util";
import { Countdown } from "./Countdown";
import { LockIcon } from "./LockIcon";
import { ProgressBar } from "./ProgressBar";

/**
 * 次のUNLOCKパネル（商品ページ・トップページ・商品カードで共通）
 * LOCKEDの淡色ストライプ＋POP BASEのNEWバッジ色の「NEXT」＋大きな残り個数
 */
export function NextUnlockPanel({ index, title, remaining, size = "lg" }: { index: number; title: string; remaining: number; size?: "lg" | "sm" }) {
  const lg = size === "lg";
  return (
    <div className={`vault relative overflow-hidden ${lg ? "rounded-2xl p-4" : "rounded-xl px-3 pb-2.5 pt-3"}`}>
      <span className={`absolute right-0 top-0 badge-new font-latin font-semibold tracking-widest ${lg ? "rounded-bl-xl px-3 py-1 text-[10px]" : "rounded-bl-lg px-2 py-0.5 text-[9px]"}`}>
        NEXT{lg && " UNLOCK"}
      </span>
      <div className={`flex items-start ${lg ? "gap-3" : "gap-2"}`}>
        <span className={`shrink-0 items-center justify-center bg-white/70 text-ink-soft ring-1 ring-white ${lg ? "flex h-12 w-12 rounded-xl" : "hidden h-8 w-8 rounded-lg sm:flex"}`}>
          <LockIcon open={false} className={lg ? "h-7 w-7" : "h-4.5 w-4.5"} />
        </span>
        <div className="min-w-0">
          <p className={`whitespace-nowrap font-latin font-semibold tracking-widest text-ink-soft ${lg ? "pr-24 text-[11px]" : "pr-10 text-[9px]"}`}>UNLOCK {String(index).padStart(2, "0")}</p>
          <p className={`break-words font-bold leading-snug ${lg ? "" : "text-xs"}`}>{title}</p>
        </div>
      </div>
      <p className={`flex flex-wrap items-baseline justify-end gap-x-1 text-ink-soft ${lg ? "mt-3 text-sm" : "mt-1.5 text-[11px]"}`}>
        <span className="whitespace-nowrap">UNLOCKまで</span>
        <span className="whitespace-nowrap">
        <b className={`font-latin font-semibold tabular-nums text-pink-700 ${lg ? "text-3xl" : "text-2xl"}`}>
          <span className={`font-sans font-bold ${lg ? "text-lg" : "text-xs"}`}>あと</span>{num(remaining)}
        </b>
        <span className="font-bold text-ink">個</span>
        </span>
      </p>
    </div>
  );
}

/**
 * 申込数・残り時間・ロックトラック・次のUNLOCK をまとめた進捗表示。
 * 商品ページとトップページの注目プロジェクトで同じ見た目にするための共通部品。
 */
export function ProjectProgress({
  total, final, targets, titles, open, endsAt, participants,
}: {
  total: number; final: boolean; targets: number[]; titles: string[]; open: boolean; endsAt: Date; participants?: number;
}) {
  const prog = progressOf(targets.map((t, i) => ({ target_qty: t, title: titles[i] ?? "" })), total);
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink-soft">{final ? "最終申込数" : "申込数"}</p>
          <p className="font-latin text-4xl font-semibold tabular-nums">{num(total)}<span className="ml-1 font-sans text-base font-bold">個</span></p>
        </div>
        <div className="text-right text-xs text-ink-soft">
          {participants !== undefined && <p>参加者 <b className="text-ink">{num(participants)}</b>人</p>}
          {open && <p className="mt-1">残り <b className="text-base text-ink"><Countdown endsAt={new Date(endsAt).toISOString()} /></b></p>}
        </div>
      </div>
      <ProgressBar total={total} targets={targets} />
      {open && (prog.next ? (
        <NextUnlockPanel index={prog.achievedCount + 1} title={prog.next.title} remaining={prog.remaining} />
      ) : targets.length > 0 ? (
        <div className="unlocked-glow flex items-center gap-3 rounded-2xl p-4 font-bold text-pink-700">
          <LockIcon open className="h-7 w-7" /> すべてのUNLOCKを達成しました！
        </div>
      ) : null)}
    </div>
  );
}
