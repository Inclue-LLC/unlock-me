import { AddressFields, formatAddress } from "@/components/AddressFields";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { listAddresses } from "@/lib/account";
import { requireUser, safeNext } from "@/lib/auth";
import { addAddressAction, defaultAddressAction, deleteAddressAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "配送先" };

export default async function AddressesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const user = await requireUser("/mypage/addresses");
  const list = await listAddresses(user.id);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Flash ok={sp.ok} error={sp.error} />
      <section>
        <h2 className="section-title">登録済みの配送先</h2>
        {list.length === 0 ? <p className="text-sm text-ink-soft">登録されていません。</p> : (
          <ul className="space-y-2">
            {list.map((a) => (
              <li key={a.id} className="card space-y-2 p-4 text-sm">
                <p>{formatAddress(a)}{a.is_default && <span className="chip ml-2 bg-[#F2F2F2] text-ink-soft">既定</span>}</p>
                <p className="text-xs text-ink-soft">TEL {a.phone}</p>
                <div className="flex gap-2">
                  {!a.is_default && <form action={defaultAddressAction}><input type="hidden" name="id" value={a.id} /><SubmitButton className="btn-outline btn-sm">既定にする</SubmitButton></form>}
                  <form action={deleteAddressAction}><input type="hidden" name="id" value={a.id} /><SubmitButton className="btn-danger btn-sm" confirm="削除しますか？（申込済みの注文の配送先は変わりません）">削除</SubmitButton></form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-ink-soft">※申込済み注文の配送先は、注文詳細から発送準備開始まで変更できます。</p>
      </section>
      <form action={addAddressAction} className="card space-y-4 p-5">
        <h2 className="font-bold">配送先を追加</h2>
        <input type="hidden" name="next" value={safeNext(sp.next, "/mypage/addresses")} />
        <AddressFields />
        <SubmitButton className="btn-primary w-full">登録する</SubmitButton>
      </form>
    </div>
  );
}
