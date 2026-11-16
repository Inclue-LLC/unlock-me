/** 本体に鍵穴が抜けた南京錠。open で掛け金が外れる */
const BODY_WITH_KEYHOLE =
  "M7.5 10.5h9a3 3 0 0 1 3 3v4.5a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-4.5a3 3 0 0 1 3-3z" +
  "M12 13a1.7 1.7 0 0 0-.85 3.17l-.45 2.03h2.6l-.45-2.03A1.7 1.7 0 0 0 12 13z";

export function LockIcon({ open, className = "h-5 w-5" }: { open: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} ${open ? "is-open" : ""}`} aria-hidden="true" fill="none">
      <path className="shackle" d="M7.8 10.5V7.8a4.2 4.2 0 0 1 8.4 0v2.7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d={BODY_WITH_KEYHOLE} fill="currentColor" fillRule="evenodd" />
    </svg>
  );
}

/**
 * UNLOCK ME のマーク。POP BASE のマーク（images/popbase-mark.svg）と同じ配色：
 * 掛け金＝奥の面のラベンダー、本体＝手前の面のピンク、鍵穴＝扉のクリーム。
 */
export function BrandMark({ className = "h-8 w-8", open = true }: { className?: string; open?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={`${className} ${open ? "is-open" : ""}`} aria-hidden="true">
      <defs>
        <linearGradient id="um-back" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#C0AFF4" /><stop offset=".45" stopColor="#D6BBF4" /><stop offset="1" stopColor="#F0C2EE" />
        </linearGradient>
        <linearGradient id="um-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FAB4D2" /><stop offset=".55" stopColor="#F7A5C0" /><stop offset="1" stopColor="#FCD2DA" />
        </linearGradient>
      </defs>
      <path className="shackle" d="M20 30V20a12 12 0 0 1 24 0v10" fill="none" stroke="url(#um-back)" strokeWidth="7" strokeLinecap="round" />
      <rect x="9" y="27" width="46" height="33" rx="10" fill="url(#um-front)" />
      <path d="M32 36a5 5 0 0 0-2.6 9.3L28 52h8l-1.4-6.7A5 5 0 0 0 32 36z" fill="#FFF6F3" />
    </svg>
  );
}

/** トップのヒーロー用：POP BASE のマークの配色の南京錠が開く演出 */
export function HeroLock({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 220" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="hl-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FAB4D2" /><stop offset=".55" stopColor="#F7A5C0" /><stop offset="1" stopColor="#FCD2DA" />
        </linearGradient>
        <linearGradient id="hl-shackle" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#C0AFF4" /><stop offset=".45" stopColor="#D6BBF4" /><stop offset="1" stopColor="#F0C2EE" />
        </linearGradient>
      </defs>
      <circle className="hero-flash" cx="100" cy="120" r="90" fill="#FFFFFF" opacity="0" />
      <path className="hero-shackle" d="M58 100V68a42 42 0 0 1 84 0v32" fill="none" stroke="url(#hl-shackle)" strokeWidth="20" strokeLinecap="round" />
      <rect x="28" y="96" width="144" height="112" rx="32" fill="url(#hl-body)" />
      <path d="M100 128a14 14 0 0 0-7 26.1l-3.8 17.9h21.6l-3.8-17.9A14 14 0 0 0 100 128z" fill="#FFF6F3" />
      <g fill="#FFD76A">
        <path d="M168 40l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" />
        <path d="M30 48l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" opacity=".8" />
      </g>
    </svg>
  );
}

/** ロゴ：マーク＋英字（Poppins）。tagline で POP BASE と同じく説明を添える */
export function Logo({ className = "", tagline = false }: { className?: string; tagline?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 text-ink ${className}`}>
      <BrandMark className="h-8 w-8" />
      <span className="font-latin text-[1.1rem] font-semibold tracking-[0.04em] whitespace-nowrap">UNLOCK ME</span>
      {tagline && (
        <small className="hidden border-l border-line pl-3 text-[0.72rem] font-bold tracking-[0.08em] whitespace-nowrap text-ink-soft sm:inline">
          参加型ECプラットフォーム
        </small>
      )}
    </span>
  );
}
