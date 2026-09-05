# Connect Spread PJ (CSPJ) — Official Website

## プロジェクト概要

Connect Spread PJ（CSPJ）の公式Webサイト。  
「その瞬間を最大限に魅せる」をコンセプトに、Web制作・映像制作・プロモーション支援を行うクリエイティブプロジェクトのブランドサイトです。

---

## デプロイ・運用(2026-09確定)

### Git

```
Repository:
https://github.com/CSPJ-Yu/CSPJ_HP

Production branch:
main
```

### Cloudflare

CSPJ本体はCloudflare PagesのGit連携方式でデプロイします。

```
GitHub main
  ↓
Cloudflare自動デプロイ
  ↓
cs-pj.com
```

**手動アップロード方式(Direct Upload)は通常運用には使用しません。** `main`へのpushが本番デプロイのトリガーです。

### 公開サイト

```
https://cs-pj.com/
https://cs-pj.com/dj/
https://cs-pj.com/dj/<slug>/
```

### 通常の更新フロー

```
1. ローカルCSPJ_HPを編集
2. 動作確認
3. git add
4. git commit
5. git push origin main
6. Cloudflare Pagesが自動デプロイ
7. cs-pj.comで本番確認
```

### プロジェクト分離

CSPJ公開HP本体と管理システムは完全に別プロジェクト・別リポジトリです。

```
CSPJ_HP        → cs-pj.com
manage.CSPJ_HP → manage.cs-pj.com
```

`manage.CSPJ_HP`のコード・設定・D1 migration・Cloudflare Access設定などを、このリポジトリ
(`CSPJ_HP`)へ混在させないこと。逆に本リポジトリの静的サイトのコード・設定を`manage.CSPJ_HP`へ
混在させないこと。

### ページ制作ルール — Footer統一方針(2026-09確定)

```
CSPJ共通ページ（/、/portal/、/portal/dj/、今後の /portal/event/ /portal/works/ /portal/shop/ 等）
→ cs-pj.comトップ（/index.html）と同じ共通Footerを使用する

個別DJサイト /dj/<slug>/（例: /dj/yu-x/）
→ DJごとの独自Footerを使用してよい（共通Footerに合わせる必要はない）
```

共通Footerの基準は常に`/index.html`の`<footer class="footer">`。各ページのCSSファイルは
独立構成のままとし（無理に共通CSS化はしない）、Footerに必要なスタイルのみを各ページ側へ
複製して反映する運用とする。

### Contact / Privacy Policy(2026-09確定)

```
/contact/  → 実際の問い合わせフォーム(送信先バックエンド未接続。送信システム準備中)
/privacy/  → プライバシーポリシー(制定日・最終改定日・バージョンを日付ベースで表示)
```

CSPJ共通ページのFooterには「Privacy Policy → /privacy/」の補助リンクを設置する
（対象: `/`, `/portal/`, `/portal/dj/`, `/contact/`, `/privacy/`, `404.html`。個別DJサイト
`/dj/<slug>/` には設置しない）。`/contact/`の同意チェックボックスは、実際の`/privacy/`への
リンク付きで表示する。

問い合わせフォームのバックエンド(`POST /api/contact`、D1保存、メール通知、Turnstile等)は
未実装。実装が確定した際は、`/privacy/`の内容(取得する情報・外部サービス・保存期間等)を
実態に合わせて改定すること。

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
