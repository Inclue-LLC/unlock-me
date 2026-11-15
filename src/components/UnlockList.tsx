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

/**
 * UNLOCK条件の一覧。前回表示時から新たに達成された条件は
 * 「鍵が開く → カードが明るくなる → 特典画像が現れる」演出を行う。
 */
export function UnlockList({ projectId, unlocks, total, final }: { projectId: number; unlocks: UnlockView[]; total: number; final: boolean }) {
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  useEffect(() => {
    const key = `um:seen-unlocks:${projectId}`;
    let seen: number[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(key) ?? "[]");
    } catch {}
    const achieved = unlocks.filter((u) => u.achieved).map((u) => u.id);
    const first = localStorage.getItem(key) === null;
    if (!first) setFresh(new Set(achieved.filter((id) => !seen.includes(id))));
    try {
      localStorage.setItem(key, JSON.stringify(achieved));
    } catch {}
  }, [projectId, unlocks]);

  return (
    <ol className="space-y-3">
      {unlocks.map((u) => {
        const open = final ? u.confirmed === true : u.achieved;
        const animate = fresh.has(u.id);
        return (
          <li
            key={u.id}
            className={`rounded-2xl border p-4 transition ${open ? "border-pink-300 bg-gradient-to-br from-pink-50 to-white" : "border-line bg-white/70"} ${animate ? "animate-unlock" : ""}`}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${open ? "bg-pink text-pink-700" : "bg-lavender-100 text-lavender-500"}`}>
                <LockIcon open={open} className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[11px] font-black tracking-widest text-ink-soft">
                    UNLOCK {String(u.index).padStart(2, "0")} / {u.target_qty.toLocaleString("ja-JP")}個
                  </span>
                  <span className={`chip ${open ? "bg-pink-500 text-white" : "bg-lavender-100 text-lavender-700"}`}>
                    {open ? "UNLOCKED" : "LOCKED"}
                  </span>
                </div>
                <p className={`mt-1 font-bold ${open ? "" : "text-ink-soft"}`}>{u.title}</p>
                {u.description && <p className="mt-1 whitespace-pre-wrap text-xs text-ink-soft">{u.description}</p>}
                {!open && !final && (
                  <p className="mt-1 text-xs text-lavender-700">あと {(u.target_qty - total).toLocaleString("ja-JP")}個 でUNLOCK</p>
                )}
                {final && u.confirmed === false && <p className="mt-1 text-xs text-ink-soft">未達成で終了しました</p>}
              </div>
              {u.image && (
                <img
                  src={u.image}
                  alt=""
                  className={`h-16 w-16 shrink-0 rounded-xl object-cover ${open ? (animate ? "animate-reveal" : "") : "opacity-40 blur-[2px] grayscale"}`}
                />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
