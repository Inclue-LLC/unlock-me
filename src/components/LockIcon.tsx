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

/** トップのヒーロー用：大きな南京錠が開く演出 */
export function HeroLock({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 220" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="hl-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F7C9D8" />
          <stop offset="1" stopColor="#C9407A" />
        </linearGradient>
        <linearGradient id="hl-shackle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E5E5E5" />
          <stop offset="1" stopColor="#A3A3A3" />
        </linearGradient>
      </defs>
      <circle className="hero-flash" cx="100" cy="120" r="90" fill="#F7C9D8" opacity="0" />
      <path className="hero-shackle" d="M58 100V68a42 42 0 0 1 84 0v32" fill="none" stroke="url(#hl-shackle)" strokeWidth="18" strokeLinecap="round" />
      <rect x="28" y="96" width="144" height="112" rx="30" fill="url(#hl-body)" />
      <rect x="28" y="96" width="144" height="112" rx="30" fill="none" stroke="#FFFFFF" strokeOpacity=".5" strokeWidth="3" />
      <path d="M100 128a14 14 0 0 0-7 26.1l-3.8 17.9h21.6l-3.8-17.9A14 14 0 0 0 100 128z" fill="#1A1A1A" />
      <g fill="#FFFFFF">
        <path d="M168 40l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" opacity=".9" />
        <path d="M30 48l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" opacity=".7" />
      </g>
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-black tracking-[0.12em] ${className}`}>
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-pink text-pink-700">
        <LockIcon open className="h-4.5 w-4.5" />
      </span>
      UNLOCK<span className="text-pink-600">ME</span>
    </span>
  );
}
