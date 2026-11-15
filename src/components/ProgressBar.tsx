import { num } from "@/lib/util";

export function ProgressBar({ total, targets, compact = false }: { total: number; targets: number[]; compact?: boolean }) {
  const sorted = [...targets].sort((a, b) => a - b);
  const max = Math.max(sorted[sorted.length - 1] ?? 1, total, 1);
  const pct = Math.min(100, (total / max) * 100);
  return (
    <div className="w-full" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={total}>
      <div className={`relative w-full rounded-full bg-lavender-100 ${compact ? "h-2" : "h-3"}`}>
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-lavender-300 to-pink-500 transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
        {!compact &&
          sorted.map((t) => (
            <span
              key={t}
              className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white ${t <= total ? "bg-pink-500" : "bg-lavender-300"}`}
              style={{ left: `${Math.min(100, (t / max) * 100)}%` }}
              title={`${num(t)}個`}
            />
          ))}
      </div>
    </div>
  );
}
