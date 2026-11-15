import Link from "next/link";
import { Logo } from "./LockIcon";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-white py-10 text-xs text-ink-soft">
      <div className="container-app space-y-4">
        <Logo className="text-sm text-ink" />
        <p>「みんなで、欲しいものを解放する。」</p>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/guide">ご利用ガイド</Link>
          <Link href="/terms">利用規約</Link>
          <Link href="/privacy">プライバシーポリシー</Link>
          <Link href="/tokushoho">特定商取引法に基づく表記</Link>
        </nav>
        <p>© UNLOCK ME / inclue</p>
      </div>
    </footer>
  );
}
