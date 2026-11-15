import Link from "next/link";
import { LockIcon } from "@/components/LockIcon";

export default function NotFound() {
  return (
    <div className="container-app py-20 text-center">
      <LockIcon open={false} className="mx-auto h-12 w-12 text-gray-300" />
      <h1 className="mt-4 text-xl font-black">ページが見つかりません</h1>
      <p className="mt-2 text-sm text-ink-soft">このページはLOCKされているか、存在しません。</p>
      <Link href="/" className="btn-primary mt-6">トップへ戻る</Link>
    </div>
  );
}
