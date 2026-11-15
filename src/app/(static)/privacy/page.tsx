import { Doc, Draft } from "../Doc";

export const metadata = { title: "プライバシーポリシー" };

export default function Page() {
  return (
    <Doc title="プライバシーポリシー">
      <Draft />
      <p>本サービスは、会員登録・購入申込・配送・決済・通知のために必要な範囲で個人情報を取得・利用します。</p>
      <h2>カード情報</h2><p>クレジットカード番号は決済事業者が保管し、本サービスでは保持しません。</p>
      <h2>第三者提供</h2><p>商品の製造・配送に必要な範囲で、出品者・配送業者へ提供することがあります。</p>
    </Doc>
  );
}
