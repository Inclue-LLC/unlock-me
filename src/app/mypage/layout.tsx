import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/app/(auth)/actions";

const NAV = [
  ["/mypage", "申込・注文"],
  ["/mypage/profile", "プロフィール"],
  ["/mypage/addresses", "配送先"],
  ["/mypage/payment-methods", "お支払い方法"],
  ["/mypage/settings", "通知・退会"],
];

export default async function MyLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/mypage");
  return (
    <div className="container-app py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-ink-soft">マイページ</p>
          <p className="font-black">{user.name} さん</p>
        </div>
        <form action={logoutAction}>
          <button className="btn-outline btn-sm">ログアウト</button>
        </form>
      </div>
      <nav className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 text-xs font-bold">
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className="shrink-0 rounded-full border border-line bg-white px-4 py-2 hover:bg-mist">{label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
