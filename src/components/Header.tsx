import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "./LockIcon";

/** POP BASE の .site-header と同じ構成：マーク＋英字ロゴ＋説明、右に丸いナビ */
export async function Header() {
  const user = await getCurrentUser();
  const nav = "rounded-full px-3.5 py-1.5 text-sm font-bold text-ink-soft hover:bg-mist hover:text-ink";
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="UNLOCK ME トップ" className="flex items-center">
          <Logo tagline />
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          <Link href="/projects" className={`hidden sm:inline ${nav}`}>プロジェクト</Link>
          <Link href="/guide" className={`hidden sm:inline ${nav}`}>ご利用ガイド</Link>
          {user?.role === "admin" && <Link href="/admin" className={nav}>管理</Link>}
          {user ? (
            <Link href="/mypage" className="btn-primary btn-sm ml-1">マイページ</Link>
          ) : (
            <>
              <Link href="/login" className={nav}>ログイン</Link>
              <Link href="/signup" className="btn-primary btn-sm ml-1">会員登録</Link>
            </>
          )}
        </nav>
      </div>
      {user && !user.email_verified_at && (
        <div className="bg-pink-50 py-2 text-center text-xs text-pink-700">
          メールアドレスの認証が完了していません。<Link href="/verify" className="font-bold underline">認証メールを再送</Link>
        </div>
      )}
    </header>
  );
}
