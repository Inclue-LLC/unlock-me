export const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県","茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県","静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県","徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

export function AddressFields() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><label className="label">お名前</label><input name="name" required maxLength={60} className="input" autoComplete="name" /></div>
      <div><label className="label">郵便番号（ハイフンなし）</label><input name="postal_code" required pattern="\d{7}" inputMode="numeric" maxLength={7} className="input" autoComplete="postal-code" /></div>
      <div>
        <label className="label">都道府県</label>
        <select name="prefecture" required className="input" defaultValue="">
          <option value="" disabled>選択してください</option>
          {PREFECTURES.map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>
      <div><label className="label">市区町村</label><input name="city" required maxLength={60} className="input" autoComplete="address-level2" /></div>
      <div><label className="label">番地</label><input name="line1" required maxLength={100} className="input" autoComplete="address-line1" /></div>
      <div className="sm:col-span-2"><label className="label">建物名・部屋番号（任意）</label><input name="line2" maxLength={100} className="input" autoComplete="address-line2" /></div>
      <div className="sm:col-span-2"><label className="label">電話番号（ハイフンなし）</label><input name="phone" required pattern="\d{10,11}" inputMode="tel" maxLength={11} className="input" autoComplete="tel" /></div>
    </div>
  );
}

export function formatAddress(a: { name: string; postal_code: string; prefecture: string; city: string; line1: string; line2?: string; phone?: string }) {
  const pc = a.postal_code.length === 7 ? `${a.postal_code.slice(0, 3)}-${a.postal_code.slice(3)}` : a.postal_code;
  return `〒${pc} ${a.prefecture}${a.city}${a.line1}${a.line2 ? " " + a.line2 : ""}　${a.name} 様`;
}
