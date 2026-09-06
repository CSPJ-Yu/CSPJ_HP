# CSPJ DJポータル — 運用ドキュメント

`/dj/` 以下でDJごとに完全に独立したサイトを運用するための構成と、
Google Forms / Google Sheetsを使った出演スケジュール管理の手順をまとめたものです。

---

## 1. 全体像

```
Google Forms（DJ本人が入力）
        ↓ 回答を自動保存
Google Sheets（DJ専用タブ・CSVとして公開）
        ↓ fetch → CSVパース → 正規化（共通処理）
/dj/shared/js/schedule-data.js
        ↓ プレーンなJSオブジェクト配列を返すだけ
各DJページの script.js
        ↓ 完全に自由なHTML/CSSで描画
DJごとに異なる見た目のページ
```

**責務分離のルール**
- `schedule-data.js` は「取得・パース・フィルタ・整形」だけを行う。HTML/CSS/DOM生成は一切含まない。
- 各DJの `script.js` が、取得したデータをどう見せるかを100%自由に決める。
- CSPJ本体（`/css/style.css` `/js/main.js`）・DJポータル（`/dj/style.css`）・各DJページのCSS/JSは互いに読み込み合わない（独立性の維持）。

## 2. 採用している運用方式：DJごとに個別タブ

複数DJのフォーム回答を1つの中央シートに自動集約する「Apps Script方式」ではなく、
**DJごとに専用のシートタブ（専用の `gid`）を持つ「個別タブ方式」**を採用しています。

理由（詳細は検討時のやり取りを参照）:
- 現状の規模（数人程度のDJ、急拡大の予定なし）では十分
- 障害発生時に「シートの中身＝サイトの表示内容」が直結しており原因特定が容易
- 独自のGoogle Apps Scriptの保守（権限再承認・トリガー監視など）が不要
- 稼働中のDJ SENNA公式サイト（別リポジトリ `DJSENNA HP Backup`）の既存実装と同じアーキテクチャで、パターンを流用できる

将来DJが増え、全DJ横断の一覧表示や一元管理が必要になった時点で、中央Eventsタブ＋
Apps Script方式へ移行できます（`schedule-data.js` は両方式に対応済み。移行時もDJページ側の
コード変更は不要です。7章参照）。

## 3. スプレッドシートの構造

CSPJが管理する1つのGoogle Sheetsファイルの中に、**DJごとに1タブ**を作成します。

タブ名の例: `senna`, `yu-x`, `sample` など（DJのslugと合わせると分かりやすい）

### 列定義（1行目はヘッダー行。列の並び順は自由）

| 列名 | 必須 | 説明 | 例 |
|---|---|---|---|
| `event_id` | 任意 | 一意なID。空でも自動生成される | `e001` |
| `dj_id` | 個別タブ方式では不要 | 中央集約方式に移行する場合のみ使用 | `senna` |
| `date` | **必須** | `YYYY-MM-DD` 形式 | `2026-09-12` |
| `event_name` | 任意 | イベント名（フェス名など） | `SAMPLE FESTIVAL` |
| `venue` | 任意 | 会場名 | `XXI SHIBUYA` |
| `location` | 任意 | 地域 | `Shibuya, Tokyo` |
| `type` | 任意 | 種別タグとして表示 | `CLUB` / `FESTIVAL` / `SPECIAL` |
| `status` | 任意（既定は`active`のみ表示） | `active` の行だけがページに表示される | `active` / `past` / `cancelled` |
| `flyer_url` | 任意 | フライヤー画像のURL(Google Driveの共有リンクを想定) | — |
| `memo` | 任意 | 備考 | — |

`date` 以外はすべて任意です。列が無ければ空文字として扱われるだけで、取得処理はエラーになりません。
実例は [`dj/sample/events.sample.csv`](sample/events.sample.csv) を参照してください。

**方針(2026-09時点)**: 開始時刻・プレイ時間などの時間関連情報は管理しません。
イベント確定時点でタイムテーブルが決まっていないことが多い、1イベント内で同じDJが複数回
プレイするケースがある、DJ本人の入力負担を減らしたい、といった理由からです。正確な出演時間は
フライヤー画像(`flyer_url`)を見てもらう運用とし、HP上ではイベント概要(日付・会場・種別)のみ
表示します。

**重要**: `status` を `active` から `past` / `cancelled` 等に変更するのはCSPJ側の手動運用です
（自動で過去日を非表示にはしません。SENNA公式サイトの現行運用と同じ仕様です）。

### シートの公開設定
- 共有設定は **「リンクを知っている全員が閲覧者」** にする(編集者リンクは絶対に公開しない)
- このCSVは実質誰でも読めるため、**非公開にしたい情報（本名・電話番号・個人メール等）は入れない**

## 4. Google Formsの作り方

DJ1人につきForm 1枚。DJ本人が入力する項目は次の6つだけです(時間関連の項目はありません)。

- 日付(date)
- イベント名(event_name、任意)
- 会場名(venue) / 地域(location)
- 種別(type)— プルダウン推奨(CLUB / FESTIVAL / SPECIAL など)
- フライヤー画像(flyer_url)— 「ファイルをアップロード」形式の質問にする(4-1参照)
- メモ(memo、任意)

`dj_id` / `event_id` / `status` はDJ本人には入力させません。

- **`dj_id`**: DJごとに専用のFormを作り、そのFormの「事前入力(prefill)されたリンク」を使って
  固定値として送る(やり方: 一度Formに自分でその値を入力した状態で 右上「⋮」→
  「事前入力リンクを取得」→ 生成されたURLをそのDJに渡す)。
  ⚠️ **注意**: prefillは「送信時にその値が入っている状態にする」機能であり、完全に隠したり
  編集不可にしたりする機能ではありません。DJ本人が値を書き換えて送信することは技術的には
  可能です。今回は少人数の信頼できる運用を前提に、まずは「DJごとの専用Form + prefill」で
  進めますが、悪用を技術的に防ぐものではない点はご認識ください(将来的に厳密化したい場合は
  Apps Scriptによるサーバー側バリデーションが必要になります)。
- **`event_id`**: 空欄のまま送信させ、`schedule-data.js`側で自動生成させる(3章参照)
- **`status`**: 空欄のまま送信させ、シート側に自動判定の数式列を足すか、CSPJが登録時に
  手動で `active` を入力する

設定のポイント:
- Formの「回答」タブ → スプレッドシートアイコン → **「既存のスプレッドシートを選択」** で、
  CSPJ管理のシートファイル内に、そのDJ専用の回答タブを作成する
- 「メールアドレスを収集する」を有効にしておくと、入力者の追跡・問い合わせ対応がしやすい
- 個別タブ方式では `dj_id` 列は不要（そのタブ自体がDJ専用のため）

### 4-1. フライヤー画像の「ファイルをアップロード」設定

- Formの質問タイプを **「ファイルをアップロード」** にする(画像のみ許可、1ファイルまで、
  容量上限は数MB程度に制限しておくと安心)
- ⚠️ **「ファイルをアップロード」機能を使うには、回答者(DJ本人)もGoogleアカウントへの
  ログインが必須になります**。匿名回答では使えない、Formsの仕様上の制約です
- アップロードされたファイルは、そのForm用にGoogle Driveへ自動作成される専用フォルダに
  保存されます。回答シートの該当列には、そのDriveファイルの共有URLが自動的に記録され、
  そのまま`flyer_url`列の値になります
- **既定では、このDriveフォルダは非公開です。** HP側から画像を表示するには、フォルダ
  (またはアップロードされた個々のファイル)の共有設定を「リンクを知っている全員が閲覧者」に
  変更する必要があります(8章のセキュリティ注意点も参照)。この変更は自動では行われないため、
  CSPJ側で都度(またはフォルダ単位でまとめて)設定してください

## 5. `schedule-data.js` の使い方

```html
<script src="/dj/shared/js/schedule-data.js"></script>
<script>
  CSPJSchedule.fetchEvents({
    csvUrl: CSPJSchedule.buildSheetCsvUrl('<スプレッドシートID>', '<このDJタブのgid>'),
    djId: 'senna',        // 表示用に付与されるだけ(個別タブ方式ではフィルタ用途では使わない)
    statusFilter: 'active' // 省略可。既定値が 'active'
  })
    .then((events) => {
      // events: [{ event_id, dj_id, date, event_name,
      //            venue, location, type, status, flyer_url, memo }, ...]
      // date昇順ソート済み。ここから先の描画は完全に自由。
    })
    .catch((err) => {
      // 取得失敗時は既存の静的HTML(プレースホルダー)をそのまま残すこと。
      console.warn('[Schedule] 読み込み失敗:', err.message);
    });
</script>
```

「FLYERを見る」ボタンから画像を表示する場合は、`loadFlyerImage()` に`flyer_url`をそのまま渡すだけです。
Drive形式のURLならlh3→ucの順に試し、それ以外の直リンクならそのまま試します。ボタンのデザイン・
モーダルのHTML/CSSはDJページ側の自由な実装です(サンプル実装は[`dj/sample/script.js`](sample/script.js)参照)。

```js
CSPJSchedule.loadFlyerImage(ev.flyer_url)
  .then((workingUrl) => { /* 自分のモーダルに <img src="workingUrl"> をセットして表示 */ })
  .catch(() => { /* 画像として表示できない場合は、元のURLへの外部リンクにフォールバック */ });
```

主な公開関数（`window.CSPJSchedule`）:

| 関数 | 用途 |
|---|---|
| `fetchEvents(options)` | CSV取得→パース→フィルタ→ソート済みの配列を返す(メイン) |
| `buildSheetCsvUrl(sheetId, gid)` | SheetsのCSVエクスポートURLを組み立てる |
| `formatDateParts(dateStr)` | `"2026-09-12"` → `{year, month:"09", monthName:"SEP", day:"12"}` |
| `escapeHtml(str)` | 外部入力をinnerHTMLに差し込む前に必ず通す(XSS対策) |
| `loadFlyerImage(rawUrl)` | flyer_urlを解決し、実際に読み込めた画像URLをPromiseで返す(Drive変換も内包) |
| `extractDriveFileId(url)` / `resolveDriveImageCandidates(url)` | `loadFlyerImage`が内部で使う低レベルヘルパー(直接使うのは高度な用途向け) |

動作サンプルは [`dj/sample/script.js`](sample/script.js) 内の `initSchedule()` / `initFlyerModal()` を参照してください
（Google Sheetsの代わりにローカルの `events.sample.csv` を読み込む例になっています）。

## 6. 新規DJを1人追加するときの手順

1. CSPJ管理のスプレッドシートに、そのDJ専用の新しいタブを作成(列は3章参照)
2. 4章の手順でGoogleフォームを新規作成し、回答先を1のタブに設定
3. `dj/<slug>/` ディレクトリを作成し、`index.html` / `style.css` / `script.js` / `images/` を新規デザインで制作
4. `index.html` に `<script src="/dj/shared/js/schedule-data.js"></script>` を追加
5. `script.js` で `CSPJSchedule.fetchEvents({ csvUrl: CSPJSchedule.buildSheetCsvUrl('<シートID>', '<2で作ったタブのgid>'), djId: '<slug>' })` を呼び出し、そのDJのHTML/CSSに合わせて描画する処理を書く
6. `dj/index.html` の `.dj-grid` にカードを1枚追加(`href="/dj/<slug>/"`)
7. DJ本人には**フォームのURLだけ**を渡す(スプレッドシートへの編集権限は渡さない)

## 7. 将来、中央Events集約方式(Apps Script)へ移行する場合

`schedule-data.js` は、取得したCSVに `dj_id` 列が存在するかどうかを自動判定します。

- **`dj_id` 列が無い(今の個別タブ方式)** → 引数の `djId` を各イベントに付与するだけ(フィルタなし)
- **`dj_id` 列がある(将来の中央Eventsタブ方式)** → 自動的に `djId` でフィルタする

つまり移行時に必要な変更は次の2点だけで、**各DJページの呼び出しコードは変更不要**です。

1. 全DJの回答をApps Script(`onFormSubmit`トリガー)で中央「Events」タブに `dj_id` 付きで転記する仕組みを追加
2. 各DJページの `csvUrl` を、個別タブのURLから中央Eventsタブの共通URLに差し替える

## 8. セキュリティ上の注意点

- スプレッドシートは「リンクを知っている全員が閲覧者」— 中身は事実上公開情報。非公開情報を書かない
- 編集者リンクは絶対に共有しない(CSPJ管理者のみが編集権限を持つ)
- 「ファイルをアップロード」質問を含むため、Formの回答自体はDJ本人のGoogleアカウントへの
  ログインが前提になる(匿名回答は不可)。あわせてメールアドレス収集も有効にしておくと、
  入力者の追跡・問い合わせ対応がしやすい
- **Driveのアップロード先フォルダの共有設定は、Sheetsの共有設定とは別物。** Sheetsを
  「リンクを知っている全員」にしても、Drive側のフォルダ/ファイルは既定で非公開のままなので、
  フライヤー画像を表示するには**個別に**「リンクを知っている全員が閲覧者」へ変更する必要がある
  (4-1章参照)
- 「リンクを知っている全員が閲覧者」に設定したDriveフォルダは、リンクさえ知っていれば
  誰でもファイル一覧を辿れる可能性があるため、フライヤー画像以外の私的ファイルを
  同じフォルダに置かない
- `dj_id`のprefillは値を隠す機能ではなく、DJ本人が書き換えて送信することも技術的には可能
  (4章参照)。少人数の信頼できる運用が前提であることを認識しておく
- `schedule-data.js` の `escapeHtml()` を必ず経由してから描画する(スプレッドシートの値は
  外部入力として扱い、そのまま`innerHTML`に差し込まない)
- APIキーやOAuth認証は一切不要(公開CSVの読み取りのみのため、鍵の漏洩リスクが存在しない)

## 9. 公開API移行方針(2026-09確定 / YU-Xで5機能すべて実装済み)

Cloudflare D1 + R2 + 公開API(`api.CSPJ_HP`、本番: `https://api.cs-pj.com`)への移行方針。
**`/dj/yu-x/`では、PROFILE(部分)/SCHEDULE/NEWS/SNS/POPUPの5機能すべてを公開API接続
済みです**(2026-09完了。1〜8章のGoogle Sheets / Forms運用は、Eventsについても
CSVモードとして`schedule-data.js`内に残っており、廃止していません。`/dj/sample/`が
引き続き使用するためです)。他のDJページ(`yu-x`以外)は今回対象外で、個別に移行が必要です。

### 9-1. Events(Schedule) — 実装済み

`dj/shared/js/schedule-data.js`の`fetchEvents()`は、渡すoptionsによってAPIモード/CSVモードを
自動判定する両対応になりました:

```html
<script src="/dj/shared/js/utils.js"></script>
<script src="/dj/shared/js/api-client.js"></script>
<script src="/dj/shared/js/schedule-data.js"></script>
<script>
  CSPJSchedule.fetchEvents({ slug: 'yu-x' })   // ← APIモード(実際のDJページはこちら)
    .then((events) => { /* 描画 */ })
    .catch((err) => { /* 静的HTMLのプレースホルダーを維持 */ });
</script>
```

- `{ slug: '<DJのslug>' }` を渡すと、`https://api.cs-pj.com/v1/djs/<slug>/events` から取得します
  (新規`api-client.js`が担当)。`status`等の公開判定はAPI側の責務で、フロント側では一切
  再実装・再フィルタしません。
- `{ csvUrl: '...' }` を渡す従来のCSVモードは変更なく残っており、`/dj/sample/`の技術サンプルは
  引き続きこちらを使います(API化していません。D1/manage側に`sample`という架空DJを作る必要も
  ありません)。
- 画像URLは`image_url`が正規フィールドです。既存のDJページ実装(`ev.flyer_url`参照)を一度に
  書き換えずに済むよう、両モードとも`flyer_url`を`image_url`と同じ値のエイリアスとして
  併せて返す互換設計にしています(段階的に`image_url`へ移行可能)。
- `formatDateParts()` / `escapeHtml()`は`dj/shared/js/utils.js`(新規)へ分離しました。
  `CSPJSchedule.formatDateParts` / `CSPJSchedule.escapeHtml`としての公開は維持しています
  (実装をCSPJUtilsへ委譲するだけで、呼び出し側の変更は不要)。
- `parseCSV()` / `buildSheetCsvUrl()` / Drive画像解決(`extractDriveFileId()`等)は削除して
  いません。`/dj/sample/`が実際に使用しているためです(過去にこのREADMEで「移行完了後に削除」
  としていた方針を修正)。
- `loadFlyerImage()`は変更していません。API由来の`image_url`(Drive形式ではない直リンク)も
  「Drive形式でない場合はそのまま1回だけ試す」という既存の分岐にそのまま乗るため、実装の
  変更が不要でした。

### 9-2. DJプロフィール — display_nameのみ実装済み(2026-09)

`dj/shared/js/profile-data.js`(`CSPJProfile.fetchProfile(slug)`)が
`GET /v1/djs/:slug` から取得する。YU-Xでは`script.js`の`initProfile()`が、
取得した`display_name`を`[data-dj-name]`を付与した全要素(ヘッダーロゴ・Hero
タイトル・フッター)へ反映する。

**API側の制約(未解消)**: D1の`djs`テーブルには`dj_id`/`display_name`/`status`/
`slug`/`email`しかカラムが無く、公開APIも`slug`/`display_name`の2項目しか返さない。
そのため、Bio文章・Genre・location・プロフィール画像は今回も動的化していない
(推測して追加していない)。各DJページのプロフィール文章セクションは、引き続き
各ページのHTMLに直接記述する運用のまま。API側にカラム・専用endpointが追加された
場合のみ、このモジュールを拡張すること。

- DJ一覧(`dj/index.html`の`.dj-grid`)は引き続き静的HTMLの手動更新のままです。公開APIに
  DJ一覧を返すエンドポイント(`GET /v1/djs`等)が無いため、現状は動的化できません。

### 9-3. News / Social Links / Popup — 実装済み(2026-09)

`GET /v1/djs/:slug/news` `GET /v1/djs/:slug/social-links` `GET /v1/djs/:slug/popup` を
それぞれ `news-data.js` / `social-data.js` / `popup-data.js` が取得し、YU-Xの`script.js`が
描画する(責務分離は他のデータモジュールと同じ)。

- **News**: `title`/`body`/`publish_date`/`image_url`を表示。`links`(関連リンク配列)は
  取得はするが今回は描画に使用しない。画像が無い記事でもレイアウトが崩れないよう
  `.news__item--with-image`修飾クラスの有無で分岐する(既存実装のまま)。
- **Social Links**: `service`/`label`/`url`を使用。標準SNS(`instagram`/`x`/`tiktok`/
  `youtube`/`facebook`/`threads`)はAPIが`label`を返さない(常にnull)ため、表示名は
  `script.js`側の定数`SERVICE_LABELS`で決定する(DJ固有コンテンツではなくUI上の
  表示名のため、ハードコード禁止方針には抵触しない)。`service='other'`の場合のみ
  APIの`label`をそのまま使う。DBに「表示ON/OFF」の真偽値カラムは存在せず、行が
  登録されていること自体が表示対象を意味する設計のため、フロント側での追加フィルタは
  行わない(URLがhttp/https以外・空の行は防御的に除外)。0件・取得失敗時は静的な
  「Coming Soon」プレースホルダーを維持する。
- **Popup**: 既存実装(2026-09の別タスクで接続済み)を維持し、今回は監査のみ。
  `expires_at`が過去の場合は`popup-data.js`側でも二重に除外する。POPUP画像の`alt`は
  API側にデータが無いため、`script.js`側で`{title}のお知らせ画像`という文脈依存の
  代替テキストを組み立てる(2026-09改善)。

### 9-4. アクセシビリティ改善(2026-09)

API由来の画像(`image_url`)には`alt`データがAPIに存在しないため、以下のように
文脈から安全な短い代替テキストを`script.js`側で組み立てるようにした:

| 画像 | alt生成ルール |
|---|---|
| NEWS一覧の画像 | `{news.title}の関連画像` |
| POPUP画像 | `{popup.title}のお知らせ画像` |
| Flyer Modal画像 | `{event.event_name}のフライヤー`(event_name が無い行は「フライヤー」) |

### 残す / 置き換える / 不要になる の仕分け(Events実装後・確定)

事前計画時点では「API移行完了後に削除」としていた項目のうち、`/dj/sample/`をCSVモードの
まま永続的に残す方針が確定したため、**実際には何も削除していません**。CSVモードの唯一の
利用者である`/dj/sample/`が、まさにこれらの関数を使い続けるためです。

| 現状の関数・ファイル | 実施結果 |
|---|---|
| `formatDateParts()` / `escapeHtml()` | **維持・移動**。`dj/shared/js/utils.js`(新規)へ実体を移動。`CSPJSchedule`からの公開は委譲のみで維持 |
| `fetchEvents()` の関数名・返却データ形式 | **維持(拡張)**。`{slug}`(APIモード)/`{csvUrl}`(CSVモード)の両対応に拡張。返却オブジェクトに`image_url`を追加(`flyer_url`は維持・エイリアス化) |
| `loadFlyerImage()` | **維持・変更なし**。API由来の`image_url`もDrive形式でない直リンクとして同じ分岐で処理できるため、実装変更は不要だった |
| `parseCSV()` | **維持**。`/dj/sample/`がCSVモードで使用し続けるため削除しない |
| `buildSheetCsvUrl()` | **維持**。現状呼び出し箇所は無いが、CSVモードの公開APIとして残す |
| `extractDriveFileId()` / `resolveDriveImageCandidates()` | **維持**。`/dj/sample/`のDrive URL解決デモ(events.sample.csvのs003行)で実際に使用中 |
| CSV用フォールバックID生成(`date__venue__index`) | **維持**。CSVモード専用のロジックとして残る(APIモードでは使われない) |
| `dj/sample/events.sample.csv` | **恒久的に維持**。API化しない技術サンプルとして今後も使用する |

### モジュール構成(2026-09時点。YU-Xで5機能すべて実装済み)

```
dj/shared/js/
├─ api-client.js    … ✅実装済み。公開APIへの共通fetch処理(認証不要・JSON取得のみ)
├─ utils.js         … ✅実装済み。formatDateParts() / escapeHtml() 等、データ非依存の共通utility
├─ profile-data.js  … ✅実装済み。GET /v1/djs/:slug(display_nameのみ。API側の制約は9-2章参照)
├─ schedule-data.js … ✅Events実装済み(API/CSV両対応)。fetchEvents()の名称・返却形式は維持
├─ news-data.js     … ✅実装済み。GET /v1/djs/:slug/news
├─ social-data.js   … ✅実装済み。GET /v1/djs/:slug/social-links
└─ popup-data.js    … ✅実装済み。GET /v1/djs/:slug/popup
```

各DJ固有の`script.js`は描画・UI制御のみを担当し、共有モジュール側はデータ取得・共通処理のみを
担当する、という現行の責務分離の考え方をそのまま踏襲しています。
