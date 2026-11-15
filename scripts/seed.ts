/**
 * 開発用シードデータ
 *   管理者:   admin@example.com / password123
 *   会員:     user@example.com  / password123
 */
import bcrypt from "bcryptjs";
import { one, pool, query } from "../src/lib/db";
import { createOrder } from "../src/lib/orders";
import { mockSaveCard } from "../src/lib/payments/mock";
import { judgeProject } from "../src/lib/settlement";
import { DEFAULT_TEMPLATES } from "../src/lib/mail/templates";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function user(email: string, name: string, role: "user" | "admin" = "user", card: "ok" | "decline" = "ok") {
  const hash = await bcrypt.hash("password123", 10);
  const u = await one<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, role, email_verified_at, payment_customer_id) VALUES ($1,$2,$3,$4,now(),$5) RETURNING id`,
    [email, hash, name, role, `mock_cus_${email}`],
  );
  const id = Number(u!.id);
  const a = await one<{ id: string }>(
    `INSERT INTO addresses (user_id, name, postal_code, prefecture, city, line1, line2, phone, is_default)
     VALUES ($1,$2,'1500001','東京都','渋谷区','神宮前1-2-3','ポップベースビル 4F','0312345678',true) RETURNING id`,
    [id, name],
  );
  const c = mockSaveCard(card);
  const pm = await one<{ id: string }>(
    `INSERT INTO payment_methods (user_id, provider, provider_ref, brand, last4, exp_month, exp_year, is_default) VALUES ($1,'mock',$2,$3,$4,$5,$6,true) RETURNING id`,
    [id, c.providerRef, c.brand, c.last4, c.expMonth, c.expYear],
  );
  return { id, addressId: Number(a!.id), pmId: Number(pm!.id) };
}

interface Seed {
  slug: string; title: string; category: string; price: number; image: string; images?: string[];
  startsIn: number; endsIn: number; featured?: boolean; sort?: number; variants?: string[];
  unlocks: [number, string, string, string?][]; description: string; ship: string; rewardUnit?: "per_order" | "per_item";
  status?: "open" | "scheduled" | "draft";
}

async function project(sellerId: number, s: Seed) {
  const p = await one<{ id: string }>(
    `INSERT INTO projects (slug, title, description, category, seller_id, price, max_per_order, max_per_user, starts_at, ends_at,
       ship_estimate, notes, main_image, status, is_featured, sort_order, reward_unit, published_at)
     VALUES ($1,$2,$3,$4,$5,$6,10,20,$7,$8,$9,$10,$11,$12,$13,$14,$15,now()) RETURNING id`,
    [s.slug, s.title, s.description, s.category, sellerId, s.price, new Date(Date.now() + s.startsIn), new Date(Date.now() + s.endsIn),
      s.ship, "・画像はイメージです。実際の商品とは色味・仕様が異なる場合があります。\n・お届けは日本国内のみとなります。",
      s.image, s.status ?? "open", !!s.featured, s.sort ?? 0, s.rewardUnit ?? "per_order"],
  );
  const id = Number(p!.id);
  for (const [i, [qty, title, desc, img]] of s.unlocks.entries()) {
    await query("INSERT INTO unlocks (project_id, target_qty, title, description, image, kind) VALUES ($1,$2,$3,$4,$5,$6)", [
      id, qty, title, desc, img ?? "", i === 0 ? "productization" : "reward",
    ]);
  }
  for (const [i, v] of (s.variants ?? []).entries()) {
    await query("INSERT INTO variants (project_id, name, sku, sort_order) VALUES ($1,$2,$3,$4)", [id, v, `${s.slug.toUpperCase()}-${i + 1}`, i]);
  }
  for (const [i, img] of (s.images ?? []).entries()) {
    await query("INSERT INTO project_images (project_id, url, sort_order) VALUES ($1,$2,$3)", [id, img, i]);
  }
  return id;
}

/** 指定数量に達するまで申込を作成 */
async function fill(projectId: number, qty: number, buyers: Awaited<ReturnType<typeof user>>[], variants: number[] = []) {
  let left = qty;
  let i = 0;
  while (left > 0) {
    const b = buyers[i % buyers.length];
    const q = Math.min(left, 1 + ((i * 7) % 6));
    const variantId = variants.length ? variants[i % variants.length] : null;
    try {
      await createOrder({ userId: b.id, projectId, items: [{ variantId, quantity: q }], addressId: b.addressId, paymentMethodId: b.pmId, idempotencyKey: `seed-${projectId}-${i}` });
      left -= q;
    } catch {
      /* 上限到達ユーザーはスキップ */
    }
    i++;
    if (i > qty * 3) break;
  }
}

async function main() {
  const existing = await one("SELECT 1 FROM users LIMIT 1");
  if (existing) {
    console.log("既にデータがあります。作り直す場合は npm run db:reset を実行してください。");
    return;
  }
  for (const t of DEFAULT_TEMPLATES) {
    await query("INSERT INTO email_templates (key, name, subject, body) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING", [t.key, t.name, t.subject, t.body]);
  }
  await user("admin@example.com", "運営 管理者", "admin");
  const demo = await user("user@example.com", "ユニ ロック");
  const buyers = [demo];
  for (let i = 1; i <= 70; i++) buyers.push(await user(`buyer${i}@example.com`, `参加者${i}`, "user", i === 3 ? "decline" : "ok"));
  const seller = await one<{ id: string }>("INSERT INTO sellers (name, description) VALUES ('POP BASE', 'キャラクター・ライフスタイルブランド') RETURNING id");
  const sellerId = Number(seller!.id);

  // 仕様書の例：ぬいぐるみプロジェクト（420個 / 300・500・1,000）
  const plush = await project(sellerId, {
    slug: "fluffy-bear-plush", title: "ふわもこベア ぬいぐるみ（全2色）", category: "ぬいぐるみ", price: 4800, image: "/demo/plush.jpg",
    images: ["/demo/plush-lavender.jpg", "/demo/mini.jpg", "/demo/charm.jpg"], startsIn: -10 * DAY, endsIn: 12 * DAY, featured: true, sort: 1,
    variants: ["ミルクホワイト", "ラベンダー"], ship: "2027年3月下旬発送予定",
    description: "ふわふわもこもこの手ざわりにこだわった、高さ約25cmのぬいぐるみ。\nPOP BASEの人気キャラクター「ふわもこベア」が、みんなの申込で商品化を目指します。\n\n・サイズ：約W20×H25×D15cm\n・素材：ポリエステル",
    unlocks: [
      [300, "ぬいぐるみ商品化決定", "申込数量300個で商品化が決定します。"],
      [500, "限定チャームをプレゼント", "ふわもこベアのアクリルチャーム（約4cm）を全員にプレゼント。", "/demo/charm.jpg"],
      [1000, "限定ミニぬいぐるみをプレゼント", "手のひらサイズのミニぬいぐるみ（約8cm）を全員にプレゼント。", "/demo/mini.jpg"],
    ],
  });
  const plushVariants = (await query("SELECT id FROM variants WHERE project_id=$1 ORDER BY sort_order", [plush])).map((v) => Number(v.id));
  await fill(plush, 418, buyers.slice(1), plushVariants); // デモ会員の2個と合わせて420個

  const acrylic = await project(sellerId, {
    slug: "acrylic-stand-party", title: "パーティーアクリルスタンド", category: "アクリル", price: 1800, image: "/demo/acrylic.jpg",
    startsIn: -5 * DAY, endsIn: 20 * HOUR, featured: true, sort: 2, ship: "2027年2月中旬発送予定",
    description: "みんなでパーティー！なアクリルスタンド。台座付き、高さ約15cm。",
    unlocks: [[100, "アクリルスタンド商品化決定", ""], [200, "限定ステッカーをプレゼント", "ステッカー5枚セット", "/demo/sticker.jpg"], [400, "背景パネルを追加", "飾れる背景パネルが付属"]],
  });
  await fill(acrylic, 186, buyers.slice(1));

  const tote = await project(sellerId, {
    slug: "canvas-tote-bag", title: "まいにちキャンバストート", category: "バッグ", price: 3200, image: "/demo/tote.jpg",
    startsIn: -2 * DAY, endsIn: 25 * DAY, sort: 3, variants: ["ナチュラル", "ピンク"], ship: "2027年4月上旬発送予定",
    description: "A4がすっぽり入る、厚手のキャンバストート。",
    unlocks: [[150, "トートバッグ商品化決定", ""], [300, "限定キーホルダーをプレゼント", "", "/demo/keyholder.jpg"]],
    rewardUnit: "per_item",
  });
  const toteVariants = (await query("SELECT id FROM variants WHERE project_id=$1 ORDER BY sort_order", [tote])).map((v) => Number(v.id));
  await fill(tote, 42, buyers.slice(1), toteVariants);

  await project(sellerId, {
    slug: "morning-mug", title: "おはようマグカップ", category: "雑貨", price: 2400, image: "/demo/mug.jpg",
    startsIn: 3 * DAY, endsIn: 30 * DAY, sort: 4, ship: "2027年5月発送予定", status: "scheduled",
    description: "朝が楽しみになるマグカップ。容量約350ml。",
    unlocks: [[200, "マグカップ商品化決定", ""], [400, "コースターをプレゼント", ""]],
  });

  await project(sellerId, {
    slug: "sticker-collection", title: "ステッカーコレクション", category: "ステーショナリー", price: 800, image: "/demo/sticker.jpg",
    startsIn: -1 * DAY, endsIn: 14 * DAY, sort: 5, ship: "2027年1月下旬発送予定",
    description: "耐水ステッカー10枚セット。",
    unlocks: [[50, "ステッカー商品化決定", ""], [120, "ホログラム仕様にアップグレード", ""], [250, "限定デザイン2枚追加", ""]],
  });
  const stickerId = Number((await one("SELECT id FROM projects WHERE slug='sticker-collection'"))!.id);
  await fill(stickerId, 47, buyers.slice(1));

  // 成立済みプロジェクト（決済失敗を1件含む）
  const done = await project(sellerId, {
    slug: "pastel-keyholder", title: "パステルキーホルダー", category: "アクセサリー", price: 1200, image: "/demo/keyholder.jpg",
    startsIn: -30 * DAY, endsIn: 1 * DAY, ship: "2027年1月中旬発送予定",
    description: "パステルカラーのラバーキーホルダー。",
    unlocks: [[30, "キーホルダー商品化決定", ""], [60, "限定ステッカーをプレゼント", ""], [120, "ミニポーチをプレゼント", ""]],
  });
  await fill(done, 75, buyers.slice(1, 25));
  await createOrder({ userId: demo.id, projectId: done, items: [{ variantId: null, quantity: 2 }], addressId: demo.addressId, paymentMethodId: demo.pmId, idempotencyKey: "seed-demo-done" });
  await query("UPDATE projects SET ends_at = now() - interval '1 minute' WHERE id=$1", [done]);
  await judgeProject(done);

  // デモ会員の参加中注文
  await createOrder({ userId: demo.id, projectId: plush, items: [{ variantId: plushVariants[1], quantity: 2 }], addressId: demo.addressId, paymentMethodId: demo.pmId, idempotencyKey: "seed-demo-plush" });

  // 送信済み扱い（開発用シードのメールは送らない）
  await query("UPDATE notifications SET status='skipped'");
  console.log("seed completed");
  console.log("  admin@example.com / password123 （運営管理者）");
  console.log("  user@example.com  / password123 （会員）");
}

main()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
