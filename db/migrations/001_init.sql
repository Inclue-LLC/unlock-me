-- UNLOCK ME 初期スキーマ
-- 金額はすべて税込・円の整数で保持する。

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ───────────── ユーザー / 認証 ─────────────
CREATE TABLE users (
  id                BIGSERIAL PRIMARY KEY,
  email             TEXT NOT NULL,
  password_hash     TEXT NOT NULL,
  name              TEXT NOT NULL DEFAULT '',
  role              TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','withdrawn')),
  email_verified_at TIMESTAMPTZ,
  notify_marketing  BOOLEAN NOT NULL DEFAULT TRUE,
  notify_progress   BOOLEAN NOT NULL DEFAULT TRUE,
  payment_customer_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at      TIMESTAMPTZ
);
-- 退会済みは同じメールで再登録できるようにする
CREATE UNIQUE INDEX users_email_active_uq ON users (lower(email)) WHERE status <> 'withdrawn';

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,          -- トークンのSHA-256
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE email_tokens (
  id          TEXT PRIMARY KEY,          -- トークンのSHA-256
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     TEXT NOT NULL CHECK (purpose IN ('verify','reset')),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE addresses (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  prefecture  TEXT NOT NULL,
  city        TEXT NOT NULL,
  line1       TEXT NOT NULL,
  line2       TEXT NOT NULL DEFAULT '',
  phone       TEXT NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX addresses_user_idx ON addresses(user_id);

-- カード番号はUNLOCK ME側で保持しない。決済事業者のトークン/IDと表示用情報のみ。
CREATE TABLE payment_methods (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL,
  provider_ref  TEXT NOT NULL,
  brand         TEXT NOT NULL DEFAULT '',
  last4         TEXT NOT NULL DEFAULT '',
  exp_month     INT,
  exp_year      INT,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_methods_user_idx ON payment_methods(user_id);

-- ───────────── 出品者 / プロジェクト ─────────────
CREATE TABLE sellers (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id                 BIGSERIAL PRIMARY KEY,
  slug               TEXT NOT NULL UNIQUE,
  title              TEXT NOT NULL,
  description        TEXT NOT NULL DEFAULT '',
  category           TEXT NOT NULL DEFAULT '',
  seller_id          BIGINT REFERENCES sellers(id),
  price              INT NOT NULL CHECK (price >= 0),          -- 税込
  max_per_order      INT NOT NULL DEFAULT 10 CHECK (max_per_order > 0),
  max_per_user       INT NOT NULL DEFAULT 20 CHECK (max_per_user > 0),
  starts_at          TIMESTAMPTZ NOT NULL,
  ends_at            TIMESTAMPTZ NOT NULL,
  ship_estimate      TEXT NOT NULL DEFAULT '',
  notes              TEXT NOT NULL DEFAULT '',
  main_image         TEXT NOT NULL DEFAULT '',
  ogp_image          TEXT NOT NULL DEFAULT '',
  ogp_title          TEXT NOT NULL DEFAULT '',
  ogp_description    TEXT NOT NULL DEFAULT '',
  -- 募集状態
  status             TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','scheduled','open','judging','succeeded','failed','suspended')),
  -- 履行状態（募集状態・UNLOCK状態とは別管理）
  fulfillment_status TEXT NOT NULL DEFAULT 'none'
                     CHECK (fulfillment_status IN ('none','manufacturing','preparing','shipping','completed')),
  reward_unit        TEXT NOT NULL DEFAULT 'per_order' CHECK (reward_unit IN ('per_order','per_item')),
  allow_cancel       BOOLEAN NOT NULL DEFAULT TRUE,     -- 募集期間中のユーザーキャンセル可否
  payment_retry_days INT NOT NULL DEFAULT 7 CHECK (payment_retry_days >= 0),
  is_featured        BOOLEAN NOT NULL DEFAULT FALSE,    -- おすすめ
  sort_order         INT NOT NULL DEFAULT 0,            -- 運営による表示順（小さいほど先頭）
  total_qty          INT NOT NULL DEFAULT 0 CHECK (total_qty >= 0), -- 有効申込数量（サーバー集計）
  final_qty          INT,                               -- 募集終了時に確定した数量
  published_at       TIMESTAMPTZ,
  judged_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX projects_status_idx ON projects(status, ends_at);

CREATE TABLE project_images (
  id          BIGSERIAL PRIMARY KEY,
  project_id  BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE variants (
  id          BIGSERIAL PRIMARY KEY,
  project_id  BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,          -- 例：ピンク / M
  sku         TEXT NOT NULL DEFAULT '',
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX variants_project_idx ON variants(project_id);

-- UNLOCK条件。最小目標数量の条件が「商品化（最低成立条件）」となる。
CREATE TABLE unlocks (
  id           BIGSERIAL PRIMARY KEY,
  project_id   BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_qty   INT NOT NULL CHECK (target_qty > 0),
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  image        TEXT NOT NULL DEFAULT '',
  kind         TEXT NOT NULL DEFAULT 'reward' CHECK (kind IN ('productization','reward')),
  achieved_at  TIMESTAMPTZ,         -- 募集期間中の達成表示（数量変動の都度再判定）
  confirmed    BOOLEAN,             -- 募集終了後の最終確定（NULL=未確定）
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, target_qty)
);
CREATE INDEX unlocks_project_idx ON unlocks(project_id, target_qty);

-- ───────────── 注文 / 決済 ─────────────
CREATE SEQUENCE order_number_seq START 100001;

CREATE TABLE orders (
  id                BIGSERIAL PRIMARY KEY,
  number            TEXT NOT NULL UNIQUE,
  user_id           BIGINT NOT NULL REFERENCES users(id),
  project_id        BIGINT NOT NULL REFERENCES projects(id),
  -- applied: 申込中 / cancelled: 取消 / void: 不成立による取消
  -- awaiting_payment: 成立・課金待ち / payment_failed: 決済失敗（再決済待ち）
  -- paid: 決済完了（注文確定） / refunded: 返金済み
  status            TEXT NOT NULL DEFAULT 'applied'
                    CHECK (status IN ('applied','cancelled','void','awaiting_payment','payment_failed','paid','refunded')),
  quantity          INT NOT NULL CHECK (quantity > 0),
  unit_price        INT NOT NULL,
  amount            INT NOT NULL,
  shipping_address  JSONB NOT NULL,        -- 申込時点のスナップショット
  address_id        BIGINT REFERENCES addresses(id),
  payment_method_id BIGINT REFERENCES payment_methods(id),
  idempotency_key   TEXT NOT NULL,
  payment_due_at    TIMESTAMPTZ,           -- 再決済期限
  fulfillment_status TEXT NOT NULL DEFAULT 'none'
                    CHECK (fulfillment_status IN ('none','manufacturing','preparing','shipped','delivered')),
  carrier           TEXT NOT NULL DEFAULT '',
  tracking_number   TEXT NOT NULL DEFAULT '',
  shipped_at        TIMESTAMPTZ,
  cancel_reason     TEXT NOT NULL DEFAULT '',
  cancelled_at      TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ,
  client_ip         TEXT NOT NULL DEFAULT '',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, idempotency_key)
);
CREATE INDEX orders_project_idx ON orders(project_id, status);
CREATE INDEX orders_user_idx ON orders(user_id, created_at DESC);

CREATE TABLE order_items (
  id          BIGSERIAL PRIMARY KEY,
  order_id    BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id  BIGINT REFERENCES variants(id),
  variant_name TEXT NOT NULL DEFAULT '',
  quantity    INT NOT NULL CHECK (quantity > 0)
);
CREATE INDEX order_items_order_idx ON order_items(order_id);

-- 確定特典（募集終了時に注文へ紐づけて保存。以後の条件変更の影響を受けない）
CREATE TABLE order_rewards (
  id          BIGSERIAL PRIMARY KEY,
  order_id    BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  unlock_id   BIGINT REFERENCES unlocks(id),
  title       TEXT NOT NULL,
  target_qty  INT NOT NULL,
  quantity    INT NOT NULL CHECK (quantity > 0),
  UNIQUE (order_id, unlock_id)
);

CREATE TABLE payments (
  id                  BIGSERIAL PRIMARY KEY,
  order_id            BIGINT NOT NULL REFERENCES orders(id),
  payment_method_id   BIGINT REFERENCES payment_methods(id),
  provider            TEXT NOT NULL,
  kind                TEXT NOT NULL DEFAULT 'charge' CHECK (kind IN ('charge','refund')),
  status              TEXT NOT NULL CHECK (status IN ('pending','succeeded','failed')),
  amount              INT NOT NULL,
  provider_payment_id TEXT,
  idempotency_key     TEXT NOT NULL UNIQUE,
  attempt             INT NOT NULL DEFAULT 1,
  error_code          TEXT NOT NULL DEFAULT '',
  error_message       TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payments_order_idx ON payments(order_id);

-- 決済事業者からのWebhook（重複受信防止）
CREATE TABLE payment_events (
  id          TEXT PRIMARY KEY,
  provider    TEXT NOT NULL,
  type        TEXT NOT NULL,
  payload     JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ───────────── 通知 ─────────────
CREATE TABLE email_templates (
  key        TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id          BIGSERIAL PRIMARY KEY,
  event_key   TEXT NOT NULL UNIQUE,        -- イベント単位の重複送信防止キー
  user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
  template    TEXT NOT NULL,
  to_email    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
  attempts    INT NOT NULL DEFAULT 0,
  error       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at     TIMESTAMPTZ
);
CREATE INDEX notifications_status_idx ON notifications(status, created_at);

-- ───────────── 履歴 / 対策 ─────────────
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
  actor_label TEXT NOT NULL DEFAULT '',
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT NOT NULL DEFAULT '',
  detail      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity, entity_id, created_at DESC);

CREATE TABLE rate_limits (
  key         TEXT PRIMARY KEY,
  count       INT NOT NULL,
  window_ends TIMESTAMPTZ NOT NULL
);
