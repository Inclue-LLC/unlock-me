/* eslint-disable @next/next/no-img-element */
import { progressOf } from "@/lib/unlock";
import { num } from "@/lib/util";
import { Countdown } from "./Countdown";
import { LockIcon } from "./LockIcon";
import { ProgressBar } from "./ProgressBar";

/**
 * 見出し用に特典名を短くする。
 *  「限定チャームをプレゼント」→「限定チャーム」／「背景パネルを追加」→「背景パネル」
 * 短くできないときは null（見出しは「〇〇」がUNLOCK！の形にする）
 */
export function unlockShortName(title: string): string | null {
  const m = title.match(/^(.+?)(?:を?プレゼント|を追加|が付属|をお届け)$/);
  return m ? m[1] : null;
}

/** 次のUNLOCKの画像：特典画像。最初のUNLOCK（商品化）で未設定なら商品の画像 */
export function nextUnlockImage(image: string | undefined, index: number, mainImage?: string) {
  return image || (index === 0 ? mainImage : undefined) || undefined;
}

/** 「あと80個で 限定チャームをUNLOCK！」の見出し */
function Headline({ index, title, remaining, lg }: { index: number; title: string; remaining: number; lg: boolean }) {
  const short = unlockShortName(title);
  const goal = index === 1 ? "商品化をUNLOCK！" : short ? `${short}をUNLOCK！` : `「${title}」がUNLOCK！`;
  return (
    <div>
      <p className="leading-none">
        <span className={`font-bold ${lg ? "text-base" : "text-sm"}`}>あと</span>
        <b className={`mx-0.5 font-latin font-semibold tabular-nums text-pink-700 ${lg ? "text-5xl" : "text-4xl"}`}>{num(remaining)}</b>
        <span className={`font-bold ${lg ? "text-base" : "text-sm"}`}>個で</span>
      </p>
      <p className={`mt-1.5 font-bold leading-snug ${lg ? "text-xl" : "text-lg"}`}>{goal}</p>
    </div>
  );
}

/**
 * 次のUNLOCKパネル（商品ページ・トップページ・商品カードで共通）
 * LOCKEDの淡色ストライプ＋POP BASEのNEWバッジ色の「NEXT」＋大きな見出し＋次の特典の画像
 */
export function NextUnlockPanel({
  index, title, remaining, image, size = "lg",
}: { index: number; title: string; remaining: number; image?: string; size?: "lg" | "sm" }) {
  const lg = size === "lg";
  return (
    <div className="vault relative overflow-hidden rounded-2xl p-4">
      <span className="absolute right-0 top-0 rounded-bl-xl badge-new px-3 py-1 font-latin text-[10px] font-semibold tracking-widest">
        NEXT UNLOCK
      </span>
      <p className="font-latin text-[11px] font-semibold tracking-widest text-ink-soft">UNLOCK {String(index).padStart(2, "0")}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <Headline index={index} title={title} remaining={remaining} lg={lg} />
        </div>
        {/* 次の特典の画像（未設定なら錠） */}
        <div className={`relative shrink-0 overflow-hidden rounded-xl bg-white/70 ring-2 ring-white ${lg ? "h-24 w-24" : "h-20 w-20"}`}>
          {image ? (
            <img src={image} alt={title} className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-ink-soft"><LockIcon open={false} className="h-9 w-9" /></span>
          )}
          {image && (
            <span className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-ink shadow">
              <LockIcon open={false} className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 申込数・残り時間・ロックトラック・次のUNLOCK をまとめた進捗表示。
 * 商品ページとトップページの注目プロジェクトで同じ見た目にするための共通部品。
 */
export function ProjectProgress({
  total, final, targets, titles, images = [], mainImage, open, endsAt, participants,
}: {
  total: number; final: boolean; targets: number[]; titles: string[]; images?: string[]; mainImage?: string; open: boolean; endsAt: Date; participants?: number;
}) {
  const prog = progressOf(targets.map((t, i) => ({ target_qty: t, title: titles[i] ?? "" })), total);
  const nextIdx = prog.next ? targets.indexOf(prog.next.target_qty) : -1;
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
        <NextUnlockPanel index={prog.achievedCount + 1} title={prog.next.title} remaining={prog.remaining} image={nextUnlockImage(images[nextIdx], nextIdx, mainImage)} />
      ) : targets.length > 0 ? (
        <div className="unlocked-glow flex items-center gap-3 rounded-2xl p-4 font-bold text-pink-700">
          <LockIcon open className="h-7 w-7" /> すべてのUNLOCKを達成しました！
        </div>
      ) : null)}
    </div>
  );
}
