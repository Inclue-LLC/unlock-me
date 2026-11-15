/* eslint-disable @next/next/no-img-element */
import type { Project } from "@/lib/types";
import { toLocalInput } from "@/lib/util";

export function ProjectFields({ p, sellers }: { p?: Project; sellers: { id: number; name: string }[] }) {
  const published = p && p.status !== "draft";
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <F label="商品名" className="md:col-span-2"><input name="title" required maxLength={120} defaultValue={p?.title} className="input" /></F>
      <F label="URL名（/projects/○○）"><input name="slug" required pattern="[a-z0-9][a-z0-9\-]{1,62}" defaultValue={p?.slug} className="input font-mono" /></F>
      <F label="カテゴリー"><input name="category" maxLength={40} defaultValue={p?.category} className="input" placeholder="ぬいぐるみ / アクリル / アパレル など" /></F>
      <F label="出品者">
        <select name="seller_id" defaultValue={p?.seller_id ?? ""} className="input">
          <option value="">（運営）</option>
          {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </F>
      <F label={`税込価格（円）${published ? " ※要例外理由" : ""}`}><input name="price" type="number" min={0} required defaultValue={p?.price} className="input" /></F>
      <F label="商品説明" className="md:col-span-2"><textarea name="description" rows={8} defaultValue={p?.description} className="input" /></F>
      <F label="1回の申込上限（個）"><input name="max_per_order" type="number" min={1} required defaultValue={p?.max_per_order ?? 10} className="input" /></F>
      <F label="お一人様の上限（個）"><input name="max_per_user" type="number" min={1} required defaultValue={p?.max_per_user ?? 20} className="input" /></F>
      <F label="募集開始日時（JST）"><input name="starts_at" type="datetime-local" required defaultValue={toLocalInput(p?.starts_at)} className="input" /></F>
      <F label="募集終了日時（JST）"><input name="ends_at" type="datetime-local" required defaultValue={toLocalInput(p?.ends_at)} className="input" /></F>
      <F label="発送予定"><input name="ship_estimate" maxLength={100} defaultValue={p?.ship_estimate} className="input" placeholder="2027年3月下旬予定" /></F>
      <F label="特典付与単位">
        <select name="reward_unit" defaultValue={p?.reward_unit ?? "per_order"} className="input">
          <option value="per_order">1注文につき各特典1点</option>
          <option value="per_item">購入商品1個につき各特典1点</option>
        </select>
      </F>
      <F label="再決済期限（成立後の決済失敗から何日）"><input name="payment_retry_days" type="number" min={0} max={60} required defaultValue={p?.payment_retry_days ?? 7} className="input" /></F>
      <F label="表示順（小さいほど先頭）"><input name="sort_order" type="number" defaultValue={p?.sort_order ?? 0} className="input" /></F>
      <div className="flex flex-wrap gap-6 md:col-span-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="allow_cancel" defaultChecked={p?.allow_cancel ?? true} className="accent-pink-600" />募集期間中のユーザーキャンセルを許可</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_featured" defaultChecked={p?.is_featured} className="accent-pink-600" />おすすめに表示</label>
      </div>
      <F label="注意事項" className="md:col-span-2"><textarea name="notes" rows={4} defaultValue={p?.notes} className="input" /></F>
      <F label="メイン画像">
        {p?.main_image && <img src={p.main_image} alt="" className="mb-2 h-24 w-24 rounded-xl object-cover" />}
        <input name="main_image_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="text-xs" />
      </F>
      <F label="OGP画像（未設定時はメイン画像）">
        {p?.ogp_image && <img src={p.ogp_image} alt="" className="mb-2 h-24 rounded-xl object-cover" />}
        <input name="ogp_image_file" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="text-xs" />
      </F>
      <F label="OGPタイトル（任意）"><input name="ogp_title" maxLength={120} defaultValue={p?.ogp_title} className="input" /></F>
      <F label="OGP説明文（任意）"><input name="ogp_description" maxLength={300} defaultValue={p?.ogp_description} className="input" /></F>
    </div>
  );
}

export function F({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
