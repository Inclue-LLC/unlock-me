"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { LockIcon } from "./LockIcon";

export interface UnlockView {
  id: number;
  index: number;
  target_qty: number;
  title: string;
  description: string;
  image: string;
  achieved: boolean;
  confirmed: boolean | null;
}

const n = (v: number) => v.toLocaleString("ja-JP");

/**
 * UNLOCK条件の一覧。
 *  LOCKED   : 金庫のような濃色カード。特典画像は錠で隠す
 *  NEXT     : 次に開く条件をピンクの枠で強調し、残り数量を大きく表示
 *  UNLOCKED : 明るく光るカード。前回表示から新たに開いたものは「鍵が開く→明るくなる→特典が現れる」演出
 */
export function UnlockList({ projectId, unlocks, total, final }: { projectId: number; unlocks: UnlockView[]; total: number; final: boolean }) {
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  useEffect(() => {
    const key = `um:seen-unlocks:${projectId}`;
    let seen: number[] | null = null;
    try {
      const raw = localStorage.getItem(key);
      seen = raw === null ? null : JSON.parse(raw);
    } catch {}
    const achieved = unlocks.filter((u) => u.achieved).map((u) => u.id);
    if (seen) setFresh(new Set(achieved.filter((id) => !seen!.includes(id))));
    try {
      localStorage.setItem(key, JSON.stringify(achieved));
    } catch {}
  }, [projectId, unlocks]);

  const nextId = final ? null : unlocks.find((u) => !u.achieved)?.id ?? null;

  return (
    <ol className="space-y-3">
      {unlocks.map((u, i) => {
        const open = final ? u.confirmed === true : u.achieved;
        const isNext = u.id === nextId;
        const animate = fresh.has(u.id);
        const prevTarget = i === 0 ? 0 : unlocks[i - 1].target_qty;
        const segPct = Math.max(0, Math.min(100, ((total - prevTarget) / (u.target_qty - prevTarget)) * 100));
        const label = `UNLOCK ${String(u.index).padStart(2, "0")}`;

        if (open) {
          return (
            <li key={u.id} className={`unlocked-glow relative overflow-hidden rounded-2xl p-4 ${animate ? "animate-unlock" : ""}`}>
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-unlock text-white shadow-md">
                  <LockIcon open className="h-7 w-7" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black tracking-widest text-unlock-700">{label}・{n(u.target_qty)}個 達成</p>
                  <p className="mt-0.5 font-black leading-snug">{u.title}</p>
                  {u.description && <p className="mt-1 whitespace-pre-wrap text-xs text-ink-soft">{u.description}</p>}
                </div>
                {u.image && <img src={u.image} alt="" className={`h-16 w-16 shrink-0 rounded-xl object-cover ring-2 ring-white ${animate ? "animate-reveal" : ""}`} />}
              </div>
              <span className="absolute right-3 top-3 rotate-6 rounded-md border-2 border-unlock px-1.5 text-[10px] font-black tracking-widest text-unlock-700">
                UNLOCKED
              </span>
            </li>
          );
        }

        return (
          <li key={u.id} className={`vault relative overflow-hidden rounded-2xl p-4 ${isNext ? "ring-4 ring-next" : "opacity-95"}`}>
            {isNext && (
              <span className="absolute right-0 top-0 rounded-bl-xl bg-next px-3 py-1 text-[10px] font-black tracking-widest text-ink">NEXT</span>
            )}
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/70 text-gray-600 ring-1 ring-white">
                <LockIcon open={false} className="h-7 w-7" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black tracking-widest text-gray-600">{label}・{n(u.target_qty)}個で解放</p>
                <p className="mt-0.5 font-black leading-snug">{u.title}</p>
                {u.description && <p className="mt-1 whitespace-pre-wrap text-xs text-ink-soft">{u.description}</p>}
              </div>
              {u.image && (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 ring-white">
                  <img src={u.image} alt="" className="h-full w-full scale-110 object-cover blur-md" />
                  <span className="absolute inset-0 flex items-center justify-center bg-gray-200/60 text-gray-600"><LockIcon open={false} className="h-6 w-6" /></span>
                </div>
              )}
            </div>
            {!final ? (
              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/60">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${segPct}%` }} />
                </div>
                <p className="mt-1.5 text-right text-xs text-ink-soft">
                  UNLOCKまで <b className={`tabular-nums ${isNext ? "text-base text-ink" : "text-ink"}`}>あと{n(u.target_qty - total)}個</b>
                </p>
              </div>
            ) : (
              <p className="mt-2 text-right text-xs text-ink-soft">未達成のまま募集終了</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
