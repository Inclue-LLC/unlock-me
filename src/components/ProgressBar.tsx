import { num } from "@/lib/util";
import { LockIcon } from "./LockIcon";

/**
 * ロックトラック：申込数量の進捗バー上に、各UNLOCK目標を南京錠で表示する。
 * 到達した錠は開いてピンクに、未到達は閉じた濃色（LOCKED）。
 */
export function ProgressBar({ total, targets, compact = false }: { total: number; targets: number[]; compact?: boolean }) {
  const sorted = [...targets].sort((a, b) => a - b);
  const max = Math.max(sorted[sorted.length - 1] ?? 1, total, 1);
  const pct = Math.min(100, (total / max) * 100);
  const pos = (t: number) => `${Math.min(100, (t / max) * 100)}%`;

  if (compact) {
    return (
      <div className="relative h-2 w-full rounded-full bg-mist" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={total}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-pink-600" style={{ width: `${pct}%` }} />
        {sorted.map((t) => (
          <span key={t} className={`absolute top-1/2 h-3 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full ${t <= total ? "bg-pink-600" : "bg-ink-soft"}`} style={{ left: pos(t) }} />
        ))}
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 pt-1" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={total}>
      <div className="relative h-3 w-full rounded-full bg-mist">
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#C0AFF4] via-[#E7B6E8] to-pink-600 transition-[width] duration-700" style={{ width: `${pct}%` }} />
        {sorted.map((t, i) => {
          const open = t <= total;
          return (
            <div key={t} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: pos(t) }}>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white shadow-md ${open ? "bg-pink-600 text-white" : "bg-ink-2 text-white"}`}
                title={`UNLOCK ${String(i + 1).padStart(2, "0")}：${num(t)}個`}
              >
                <LockIcon open={open} className="h-4 w-4" />
              </span>
              <span className={`absolute left-1/2 top-9 -translate-x-1/2 whitespace-nowrap text-[10px] font-black tabular-nums ${open ? "text-pink-700" : "text-ink-soft"}`}>
                {num(t)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
