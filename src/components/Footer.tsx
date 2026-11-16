import Link from "next/link";
import { Logo } from "./LockIcon";

/** POP BASE の .site-footer と同じ：中央寄せ・小さなリンク */
export function Footer() {
  return (
    <footer className="mt-16 border-t border-line px-4 pb-12 pt-8 text-center text-sm text-ink-soft">
      <div className="mb-4 flex justify-center"><Logo /></div>
      <nav className="mx-auto mb-3 flex max-w-3xl flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs">
        <Link href="/guide" className="hover:text-ink hover:underline">ご利用ガイド</Link>
        <Link href="/tokushoho" className="hover:text-ink hover:underline">特定商取引法に基づく表記</Link>
        <Link href="/privacy" className="hover:text-ink hover:underline">プライバシーポリシー</Link>
        <Link href="/terms" className="hover:text-ink hover:underline">利用規約</Link>
      </nav>
      <p className="font-latin text-xs">© UNLOCK ME</p>
    </footer>
  );
}
