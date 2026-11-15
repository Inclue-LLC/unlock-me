import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: { default: "運営管理", template: "%s｜運営管理｜UNLOCK ME" }, robots: { index: false } };

const NAV = [
  ["/admin", "ダッシュボード"],
  ["/admin/projects", "プロジェクト"],
  ["/admin/orders", "注文・決済"],
  ["/admin/shipping", "配送"],
  ["/admin/users", "ユーザー"],
  ["/admin/sellers", "出品者"],
  ["/admin/notifications", "通知"],
  ["/admin/exports", "集計・出力"],
  ["/admin/audit", "操作履歴"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      <nav className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 pb-2 text-xs font-bold">
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className="shrink-0 rounded-full px-3 py-2 hover:bg-gray-100">{label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
