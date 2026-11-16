# UNLOCK ME（Claude Code 向けメモ）

購入申込数量に応じて商品化・特典が UNLOCK される参加型EC。仕様・セットアップは README.md を参照。

## デザインの参照元：POP BASE

「POP BASEを参考に」「POP BASEに合わせて」と言われたら、**GitHub の `Inclue-LLC/popbase`（公開リポジトリ）** を指す。
推測で色を決めず、必ずリポジトリを読んで実際の値を確認すること。

```bash
git clone --depth 1 https://github.com/Inclue-LLC/popbase ../popbase
```

- デザインの値：`css/style.css` の `:root`（`--brand-*`・`--ink`・`--pink`・`--accent`・`--radius`・`--shadow`）
- ロゴ・マーク：`images/logo/`・`images/popbase-mark.svg`
- ブランドの説明：README.md の「ブランドデザイン（POP BASE）」

UNLOCK ME での反映先：`src/app/globals.css` の `@theme`（コメントに POP BASE の変数名を記載）と、
フォント（`src/app/layout.tsx`：Poppins / Zen Kaku Gothic New）。

## UNLOCK ME 独自の UI ルール（POP BASE の上に足しているもの）

- LOCKED：淡色＋斜めストライプ（`vault`）、閉じた錠
- UNLOCKED：ピンク（`unlocked-glow`・`pink-600`）、開いた錠
- NEXT：POP BASE の NEW バッジと同じ黄色（`badge-new`）
- 主ボタン：POP BASE の `.btn-primary`（濃色のピル）
- グラデーションは要所だけ（ロゴ・ヒーロー・メインの進捗バー・申込完了パネル）
- 文字のコントラストは 4.5 以上を目安（POP BASE のピンク・紫を文字に使うときは `pink-700`・`accent` の濃い版）

## 開発メモ

- 型チェック `npx tsc --noEmit`、テスト `npm test`（PostgreSQL の unlockme_test を使用）
- ユーザーへの説明は日本語で、非エンジニアにもわかる言葉で
