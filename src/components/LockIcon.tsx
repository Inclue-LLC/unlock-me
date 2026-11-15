export function LockIcon({ open, className = "h-5 w-5" }: { open: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} ${open ? "is-open" : ""}`} aria-hidden="true" fill="none">
      <path className="shackle" d="M7.5 10.5V7.8a4.5 4.5 0 0 1 9 0v2.7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="3" fill="currentColor" />
      <circle cx="12" cy="15.4" r="1.6" fill="white" />
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-black tracking-[0.12em] ${className}`}>
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-pink text-pink-700">
        <LockIcon open className="h-4 w-4" />
      </span>
      UNLOCK<span className="text-pink-500">ME</span>
    </span>
  );
}
