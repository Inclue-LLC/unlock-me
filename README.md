# UNLOCK ME

「みんなで、欲しいものを解放する。」

購入申込数量に応じて商品化や追加特典が段階的に UNLOCK される、参加型 EC プラットフォーム。
「UNLOCK ME サービス開発仕様書 Ver.1.0」の MVP（14章）を実装しています。

## 技術構成

| 項目 | 採用 |
| --- | --- |
| アプリ | Next.js 15（App Router / Server Actions）+ React 19 + TypeScript |
| DB | PostgreSQL（`pg`、SQLマイグレーション `db/migrations/`） |
| スタイル | Tailwind CSS v4（POP BASE のデザインシステムに準拠：`Inclue-LLC/popbase` の `css/style.css`。フォント Poppins / Zen Kaku Gothic New） |
| 決済 | プロバイダ抽象化：`mock`（開発用）／ `stripe`（SetupIntent + 成立後オフセッション課金） |
| メール | `log`（`.mail/` に書き出し）／ `smtp`（nodemailer） |
| 定期処理 | `npm run worker`（常駐）または `POST /api/cron/tick` |

## セットアップ

```bash
cp .env.example .env
```

```bash
npm install
```

```bash
npm run db:reset   # マイグレーション + シードデータ
```

```bash
npm run dev        # http://localhost:3000
```

```bash
npm run worker     # 別ターミナルで定期処理（募集開始・終了判定・課金・通知配信）
```

シードアカウント（パスワードはいずれも `password123`）

- 運営管理者：`admin@example.com`（`/admin`）
- 会員：`user@example.com`

開発時のメールは `.mail/` にテキストで保存されます（会員登録の認証URLもここで確認）。

テスト（PostgreSQL の `unlockme_test` DB を使用）:

```bash
npm test
```

## 主な機能（仕様書との対応）

- **UNLOCK（2章・8章）**：1プロジェクトに複数段階。目標は申込個数で集計。プロジェクト行ロック下でサーバー集計し、数量変動の都度すべての条件を再判定。特典は累積。付与単位（注文ごと／商品ごと）はプロジェクト設定。
- **購入〜発送（3章）**：申込 → 数量集計 → UNLOCK表示 → 募集終了で成立判定 → 成立なら課金・特典確定／不成立なら取消・通知 → 製造・発送。
- **ユーザー画面（5章）**：トップ（おすすめ／もうすぐUNLOCK／募集終了間近／新着／UNLOCK達成済み）、商品詳細（鍵の LOCKED/UNLOCKED、カウントダウン、進捗）、購入申込（確認画面・確認メール）、会員登録（メール認証・再設定・退会）、マイページ（注文・UNLOCK状況・配送状況・決済方法・配送先・通知設定）、SNS共有（X / LINE / URLコピー / 画像保存 / Web Share、商品別OGP）。
- **状態管理（6章）**：募集状態・UNLOCK達成状態・履行状態を別管理。
- **決済（7章）**：方式B（成立後課金）。冪等キー付きで二重課金防止、結果はサーバー側で反映、Stripe Webhook は署名検証＋イベントID重複排除。カード番号は保持しない。決済失敗時は再決済期限を設定、期限切れは取消。
- **運営管理（10章）**：ダッシュボード（売上・申込数量・成立率）、プロジェクト（作成・編集・公開・停止・終了・UNLOCK条件・バリエーション・画像）、注文・決済（取消・返金・再決済・期限延長）、配送（状況更新・追跡番号CSV一括取込）、ユーザー（利用停止・権限）、出品者、通知（テンプレート編集・送信履歴・再送）、CSV（注文／製造・発送／製造数量／売上・精算）、操作履歴。
- **メール通知（11章）**：イベント単位の一意キーで重複送信を防止し、履歴を保存。
- **安全性（13章）**：トランザクション制御、購入数量上限、レート制限（申込・ログイン等）、運営取消、全操作の監査ログ、画像の長期キャッシュ。

## 仕様書15章「開発前の確定事項」に対する実装上の初期値

いずれも暫定で、確定次第変更できるようにしています。

| 項目 | 本実装の扱い | 変更箇所 |
| --- | --- | --- |
| 決済方式・事業者 | 方式B（成立後課金）。Stripe 実装あり（未接続・要実キーでの検証）、既定はモック | `src/lib/payments/` |
| 成立判定 | 期間中の達成は暫定表示。**募集終了時の有効申込数量で最終確定** | `src/lib/settlement.ts` |
| キャンセル | プロジェクト毎に可否を設定。可の場合は募集期間中のみ | `allow_cancel` |
| 特典付与単位 | プロジェクト設定（初期値：1注文につき各1点） | `reward_unit` |
| 決済失敗 | 再決済期限（初期7日・プロジェクト設定）。**UNLOCK再判定・成立取消はしない**。期限切れは注文取消 | `settlement.ts` |
| 公開後の条件変更 | 理由入力必須・操作履歴・参加者へメール通知 | `src/lib/admin-projects.ts` |
| 販売主体／製造・配送 | 運営（インクルー）一括を前提。出品者はマスタのみ | — |
| システム構成 | 独自開発 | — |

## 本番化に向けて残っている作業

- Stripe 実キーでの結合テスト（3Dセキュア・Webhook）と、決済事業者の確定
- 画像ストレージを S3 等 + CDN へ差し替え（`src/lib/storage.ts`）
- SMTP / メール配信サービスの設定、送信ドメイン認証
- 利用規約・プライバシーポリシー・特商法表記の確定版（現在は雛形）
- HTTPS 環境での運用（`APP_URL` が `https://` の場合のみ Cookie に Secure 属性を付与）
- 定期処理のスケジューラ設定（worker 常駐 or 1分毎の `/api/cron/tick`）

## ディレクトリ

```
db/migrations/        SQLスキーマ
scripts/              migrate / seed / worker
src/lib/              ドメインロジック（orders, unlock, settlement, admin-projects, payments, mail, auth）
src/app/              画面（ユーザー / mypage / admin）と API ルート
tests/                Vitest（実DBで同時申込・成立判定・決済失敗などを検証）
```
