# Connect Spread PJ (CSPJ) — Official Website

## プロジェクト概要

Connect Spread PJ（CSPJ）の公式Webサイト。  
「その瞬間を最大限に魅せる」をコンセプトに、Web制作・映像制作・プロモーション支援を行うクリエイティブプロジェクトのブランドサイトです。

---

## デザインコンセプト

- **配色**: ダークグレー（#0e0e0e）基調のモノトーン
- **タイポグラフィ**: Cormorant Garamond（セリフ）× Inter（サンセリフ）× Noto Serif JP（日本語）
- **スタイル**: ミニマル・高級感・大胆な余白
- **参考**: Apple / Aesop / SP-D のような上質なクリエイティブスタジオの世界観

---

## 実装済み機能

- **Heroセクション**: フルビューポート、洗練されたタイポグラフィ、入場アニメーション
- **Conceptセクション**: ブランドコンセプトのテキスト表示
- **Servicesセクション**: 3サービスカード（DJ Web制作 / 低価格短納期 / 映像一括対応）
- **Selected Worksセクション**: 3作品（DJ SENNA / WDJF 2025 / Web Event Flyer）
- **How We Workセクション**: 3ステッププロセス（Connect / Create / Spread）
- **Start a Projectセクション**: CTAセクション（価格表なし・相談促進）
- **Contactセクション**: Instagram / Contact Form / Email の3リンク
- **お問い合わせフォーム**: 名前・メール・サービス選択・メッセージ → Table API保存
- **スクロールアニメーション**: IntersectionObserver による上品なフェードイン
- **固定ナビゲーション**: スクロール時の背景フロスト効果
- **モバイル対応**: ハンバーガーメニュー・全セクションレスポンシブ

---

## ファイル構成

```
index.html          # メインページ
css/
  style.css         # メインスタイルシート
js/
  main.js           # インタラクション・アニメーション
README.md
```

---

## URL構成

| パス       | 内容                          |
|------------|-------------------------------|
| `/`        | メインページ (index.html)     |
| `#hero`    | ヒーローセクション            |
| `#concept` | コンセプト                    |
| `#what-we-do` | サービス紹介               |
| `#works`   | 選定作品                      |
| `#how-we-work` | プロセス                  |
| `#start`   | プロジェクト開始CTA           |
| `#contact` | コンタクト・フォーム          |

---

## データモデル

### `inquiries` テーブル（Table API）

| フィールド     | 型        | 説明                   |
|----------------|-----------|------------------------|
| id             | text      | 自動付与UUID           |
| name           | text      | 送信者名               |
| email          | text      | メールアドレス         |
| service        | text      | 希望サービス           |
| message        | rich_text | メッセージ本文         |
| submitted_at   | datetime  | 送信日時               |

---

## Cloudflare Pages 移行メモ（2026-08-27）

静的HTML/CSS/JSのみの構成のため、ビルド設定不要でCloudflare Pagesにそのままデプロイ可能。
`images/`, `css/`, `js/` はすべてサイト内配信のローカルファイルで、外部画像URL・Google Sites/Genspark由来URLは存在しない。

- 追加: favicon一式（`images/favicon.ico` 他）, apple-touch-icon, OGP画像（`images/ogp/ogp-default.jpg`）, canonical/OGP/Twitter Cardメタタグ
- 追加: 内部リンク（css/js/images）を絶対パス（`/images/...`）に統一（将来 `/works/` 等のサブディレクトリを追加した際に相対パス切れを防ぐため）
- 修正: モバイルのハンバーガーボタン・CTAリンクのタップ領域を44px相当に拡大（見た目は変更なし）
- 修正: `aria-labelledby="concept-heading"` が参照先を持たなかったため、視覚的には非表示の`<h2>`を追加して紐付け修正

## 今後の推奨対応

- [ ] 実際のInstagramリンクをContactセクションへ設定
- [ ] 実際のメールアドレスをContactセクション・フッターへ設定
- [ ] Selected WorksにGoogleフォトなどの実際の画像を設置
- [ ] Works詳細ページの追加（/works/dj-senna など）
- [x] OGP画像（og:image）の作成・設定
- [x] favicon の作成・設定
- [ ] Google Analytics などのトラッキング設定（任意）
- [ ] **お問い合わせフォームの送信先**: `js/main.js` が `fetch('tables/inquiries', ...)` を呼んでいるが、これはGenspark環境が提供していたTable API（バックエンド）宛のエンドポイントで、Cloudflare Pages（静的ホスティング）には存在しない。現状はリクエストが失敗しても`catch`で握りつぶし「送信しました」と表示するため、ユーザーには送信成功に見えるが実際はどこにも届いていない。Cloudflare Pages Functions + メール送信サービス、または外部フォームサービス（例: Formspree等）への差し替えが必要。
