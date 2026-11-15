import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Logo } from "./LockIcon";

export async function Header() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
      <div className="container-app flex h-14 items-center justify-between">
        <Link href="/" aria-label="UNLOCK ME トップ">
          <Logo className="text-base" />
        </Link>
        <nav className="flex items-center gap-2 text-xs font-bold">
          <Link href="/projects" className="hidden rounded-full px-3 py-2 hover:bg-[#F2F2F2] sm:inline">プロジェクト一覧</Link>
          {user?.role === "admin" && (
            <Link href="/admin" className="rounded-full px-3 py-2 text-ink-soft hover:bg-[#F2F2F2]">管理</Link>
          )}
          {user ? (
            <Link href="/mypage" className="btn-soft btn-sm">マイページ</Link>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-3 py-2 hover:bg-[#F2F2F2]">ログイン</Link>
              <Link href="/signup" className="btn-primary btn-sm">会員登録</Link>
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
