import { num } from "@/lib/util";
import { LockIcon } from "./LockIcon";

/**
 * ロックトラック：申込数量の進捗バー上に、各UNLOCK目標を南京錠で表示する。
 * 到達した錠は開いてピンクに、未到達は閉じた濃色（LOCKED）。
 */
export function ProgressBar({ total, targets, compact = false, size = "lg" }: { total: number; targets: number[]; compact?: boolean; size?: "lg" | "sm" }) {
  const sm = size === "sm";
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
    <div className={sm ? "px-3 pb-7 pt-1" : "px-4 pb-6 pt-1"} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={total}>
      <div className={`relative w-full rounded-full bg-mist ${sm ? "h-2" : "h-3"}`}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#C0AFF4] via-[#E7B6E8] to-pink-600 transition-[width] duration-700" style={{ width: `${pct}%` }} />
        {sorted.map((t, i) => {
          const open = t <= total;
          return (
            <div key={t} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: pos(t) }}>
              <span
                className={`flex items-center justify-center rounded-full border-white shadow-md ${sm ? "h-6 w-6 border-2" : "h-8 w-8 border-[3px]"} ${open ? "bg-pink-600 text-white" : "bg-ink-2 text-white"}`}
                title={`UNLOCK ${String(i + 1).padStart(2, "0")}：${num(t)}個`}
              >
                <LockIcon open={open} className={sm ? "h-3 w-3" : "h-4 w-4"} />
              </span>
              <span className={`absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-latin font-semibold tabular-nums ${sm ? "top-7 text-[9px]" : "top-9 text-[10px]"} ${open ? "text-pink-700" : "text-ink-soft"}`}>
                {num(t)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
