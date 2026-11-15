import { Doc, Draft } from "../Doc";

export const metadata = { title: "特定商取引法に基づく表記" };

export default function Page() {
  return (
    <Doc title="特定商取引法に基づく表記">
      <Draft />
      <dl className="grid grid-cols-[8rem_1fr] gap-y-2"><dt>販売事業者</dt><dd>（確定後に記載）</dd><dt>所在地</dt><dd>（確定後に記載）</dd><dt>販売価格</dt><dd>各商品ページに記載（税込）</dd><dt>支払方法</dt><dd>クレジットカード</dd><dt>支払時期</dt><dd>募集終了後、成立判定時</dd><dt>引渡時期</dt><dd>各商品ページの発送予定</dd><dt>返品・キャンセル</dt><dd>各商品ページ・ご利用ガイドに記載</dd></dl>
    </Doc>
  );
}
