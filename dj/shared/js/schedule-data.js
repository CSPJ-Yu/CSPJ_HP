/**
 * CSPJ — Shared Schedule Data Layer
 * /dj/shared/js/schedule-data.js
 *
 * 目的:
 *   出演スケジュールを取得・正規化する「データ取得だけ」を共通化したモジュールです。
 *   HTML生成・CSS・デザインは一切含みません。各DJページは、このモジュールが返す
 *   プレーンなJSオブジェクト配列を受け取り、完全に自由なHTML/CSSで描画してください。
 *
 * 【2026-09 公開API移行】
 *   fetchEvents() は呼び出し時のoptionsによって2つのモードを自動判定します:
 *
 *   - APIモード（実際のDJページはこちらを使う）: `{ slug: '<djのslug>' }` を渡す。
 *     公開API（api.cs-pj.com、/dj/shared/js/api-client.js 経由）からJSONで取得する。
 *     公開/非公開・期限切れ等の判定はAPI側で完結しており、ここでは一切再実装・再検証しない。
 *
 *   - CSVモード（既存互換。/dj/sample/ の技術サンプルは今後もこちらを使い続ける）:
 *     `{ csvUrl: '...' }` を渡す。Google SheetsのCSVエクスポート、またはローカルCSVファイルを
 *     fetchしてパースする。このモードのコード（parseCSV / buildSheetCsvUrl / Google Drive画像
 *     解決）は、API移行後も /dj/sample/ が実際に使用しているため削除していません
 *     （events.sample.csv の s003 行は、Drive URL解決の失敗→外部リンクフォールバックの
 *     デモを兼ねています）。
 *
 *   どちらのモードでも返却データの形は統一されています（fetchEvents のJSDoc参照）。
 *   画像URLは新フィールド `image_url` が正規ですが、既存のDJページ実装（`ev.flyer_url` を
 *   参照するコード）を一度に書き換えずに済むよう、両モードとも `flyer_url` を
 *   `image_url` と同じ値のエイリアスとして併せて返します（段階的に `image_url` へ
 *   移行できるようにするための互換措置。値はどちらも常に同一で、一方だけが更新される
 *   ことはありません）。
 *
 * 使い方（APIモード・実際のDJページ）:
 *   <script src="/dj/shared/js/utils.js"></script>
 *   <script src="/dj/shared/js/api-client.js"></script>
 *   <script src="/dj/shared/js/schedule-data.js"></script>
 *   <script>
 *     CSPJSchedule.fetchEvents({ slug: 'yu-x' })
 *       .then((events) => { ...自分のHTMLで描画... })
 *       .catch((err) => {
 *         // 取得失敗時（DJ不存在／非公開／ネットワークエラー等）は既存の静的HTML
 *         // （プレースホルダー）をそのまま残すこと。
 *         console.warn('[Schedule] 読み込み失敗:', err.message);
 *       });
 *   </script>
 *
 * 使い方（CSVモード・従来互換 / dj/sample/）:
 *   <script src="/dj/shared/js/utils.js"></script>
 *   <script src="/dj/shared/js/schedule-data.js"></script>
 *   <script>
 *     CSPJSchedule.fetchEvents({ csvUrl: 'events.sample.csv', djId: 'sample' })
 *       .then((events) => { ... })
 *       .catch((err) => { ... });
 *   </script>
 *
 * 移行方針の詳細は /dj/README.md の「9. 公開API移行方針」を参照。
 */
(function (global) {
  'use strict';

  /* ============================================================
     A) CSVパーサー（RFC 4180準拠：ダブルクォート・カンマ・改行対応）
     DJ SENNA公式サイト（/js/main.js）の実装をベースにしています。
     【維持】/dj/sample/ の技術サンプル（CSVモード）が引き続き使用します。
     ============================================================ */
  function parseCSV(text) {
    const rows = [];
    let cur = '', inQ = false, row = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i], nx = text[i + 1];
      if (inQ) {
        if (ch === '"' && nx === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQ = false; }
        else { cur += ch; }
      } else {
        if (ch === '"') { inQ = true; }
        else if (ch === ',') { row.push(cur.trim()); cur = ''; }
        else if (ch === '\n') { row.push(cur.trim()); rows.push(row); row = []; cur = ''; }
        else if (ch === '\r') { /* skip CR */ }
        else { cur += ch; }
      }
    }
    if (cur !== '' || row.length > 0) { row.push(cur.trim()); rows.push(row); }
    return rows;
  }

  /* ============================================================
     B) Google SheetsのCSVエクスポートURLを組み立てるヘルパー
     【維持】CSVモードの利用者向けに残しています。現時点でこのリポジトリ内に実際の
     呼び出し箇所はありません（/dj/sample/ はローカルCSVのファイル名を直接指定しているため）。
     ============================================================ */
  function buildSheetCsvUrl(sheetId, gid) {
    const g = (gid === undefined || gid === null || gid === '') ? '0' : gid;
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${g}`;
  }

  /* ============================================================
     C) 日付整形 / D) HTMLエスケープ
     【変更】実体は /dj/shared/js/utils.js（CSPJUtils）へ移動しました。データ取得元
     （CSV/API）に依存しない共通utilityとして分離するためです。ここでは後方互換のため
     CSPJSchedule.formatDateParts / CSPJSchedule.escapeHtml として引き続き公開しますが、
     実装はCSPJUtilsへの委譲のみです（呼び出し側のコード変更は不要）。
     ============================================================ */
  function requireUtils() {
    if (!global.CSPJUtils) {
      throw new Error(
        '[CSPJSchedule] CSPJUtils が見つかりません。<script src="/dj/shared/js/utils.js"> を ' +
        'schedule-data.js より前に読み込んでください。'
      );
    }
    return global.CSPJUtils;
  }
  function formatDateParts(dateStr) { return requireUtils().formatDateParts(dateStr); }
  function escapeHtml(str) { return requireUtils().escapeHtml(str); }

  /* ============================================================
     E) Google DriveのファイルURLからFILE_IDを抽出（フライヤー画像用・任意）
     DJ SENNA公式サイトの実装をベースにしています。
     【維持】/dj/sample/ の技術サンプルが、Drive URL解決の成功/失敗パターンを具体的に
     確認するために使用しています（events.sample.csv 参照）。
     ============================================================ */
  function extractDriveFileId(rawUrl) {
    if (!rawUrl) return null;
    const url = rawUrl.trim();
    const m1 = url.match(/[?&]id=([A-Za-z0-9_-]+)/);
    if (m1) return m1[1];
    const m2 = url.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
    if (m2) return m2[1];
    const m3 = url.match(/googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/);
    if (m3) return m3[1];
    return null;
  }

  /** rawUrl（Driveの共有URL）から、表示を試す順に候補URLを返す。取得失敗時は
   *  呼び出し側で <a href="rawUrl" target="_blank"> 等の外部リンクにフォールバックすること。 */
  function resolveDriveImageCandidates(rawUrl) {
    const fileId = extractDriveFileId(rawUrl);
    if (!fileId) return [];
    return [
      `https://lh3.googleusercontent.com/d/${fileId}`,
      `https://drive.google.com/uc?export=view&id=${fileId}`,
    ];
  }

  /** flyer_url/image_url（Driveの共有URLでも、それ以外の直リンク画像URLでもよい）から、
   *  実際にブラウザで読み込める画像URLをPromiseで返す汎用ユーティリティ。
   *
   *  試行順序:
   *    1. rawUrlがGoogle DriveのURL形式 → lh3.googleusercontent.com → drive.google.com/uc の順に試す
   *    2. Drive形式でない場合 → rawUrlをそのまま1回だけ試す
   *  すべて失敗した場合はreject。呼び出し側は「元のURLを新規タブで開く」等の
   *  外部リンクにフォールバックすること。
   *
   *  【2026-09 API移行】公開APIが返す `image_url`（api.cs-pj.com配下の直リンク）は
   *  Drive形式ではないため、自動的に上記2.の分岐（そのまま1回だけ試す）に入ります。
   *  Drive解決ロジックと共存できるため、本関数自体への変更は不要でした。 */
  function loadFlyerImage(rawUrl) {
    return new Promise((resolve, reject) => {
      if (!rawUrl) { reject(new Error('image url is empty')); return; }

      const driveCandidates = resolveDriveImageCandidates(rawUrl);
      const candidates = driveCandidates.length ? driveCandidates : [rawUrl];

      tryNext(0);

      function tryNext(i) {
        if (i >= candidates.length) {
          reject(new Error('flyer image failed to load from all candidate URLs'));
          return;
        }
        const img = new Image();
        img.onload = () => resolve(candidates[i]);
        img.onerror = () => tryNext(i + 1);
        img.src = candidates[i];
      }
    });
  }

  /* ============================================================
     F-1) APIモード: 公開API（api.cs-pj.com）からeventsを取得
     ============================================================ */
  async function fetchEventsFromApi(slug) {
    const api = global.CSPJApi;
    if (!api) {
      throw new Error(
        '[CSPJSchedule] CSPJApi が見つかりません。<script src="/dj/shared/js/api-client.js"> を ' +
        'schedule-data.js より前に読み込んでください。'
      );
    }
    const json = await api.getJson(api.djPath(slug, 'events'));
    const rawEvents = (json && json.events) || [];

    return rawEvents.map((row) => ({
      event_id: row.event_id,
      dj_id: slug,
      date: row.date,
      event_name: row.event_name,
      venue: row.venue,
      location: row.location,
      type: row.type,
      // API側は「公開してよいもの（status='published'）」だけを返す設計であり、
      // その判定をここで再実装・再検証はしない（返ってきた時点で公開確定として扱う）。
      status: 'published',
      image_url: row.image_url,  // 正規フィールド。未設定の場合は null（呼び出し側はnullチェックのみでよい）
      flyer_url: row.image_url,  // 既存互換フィールド（段階移行用エイリアス。値はimage_urlと同一）
      memo: '',                   // 公開APIは内部メモを一切返さない設計のため、常に空文字
    }));
  }

  /* ============================================================
     F-2) CSVモード: 既存実装（挙動は変更なし。image_urlフィールドを追加で併記するのみ）
     ============================================================ */
  const KNOWN_COLUMNS = [
    'event_id', 'dj_id', 'date', 'event_name',
    'venue', 'location', 'type', 'status', 'flyer_url', 'memo',
  ];

  async function fetchEventsFromCsv({ csvUrl, djId, statusFilter }) {
    const res = await fetch(csvUrl);
    if (!res.ok) throw new Error(`Sheet fetch failed: HTTP ${res.status}`);

    const text = await res.text();
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error('No data rows in sheet');

    const headers = rows[0].map((h) => h.toLowerCase().trim());
    const idx = {};
    KNOWN_COLUMNS.forEach((col) => { idx[col] = headers.indexOf(col); });

    if (idx.date === -1) {
      throw new Error('Missing required column: date');
    }

    const hasSheetDjId = idx.dj_id !== -1;

    let events = rows.slice(1)
      .map((r, i) => {
        const get = (col) => (idx[col] !== -1 ? (r[idx[col]] || '').trim() : '');
        const rowDjId = hasSheetDjId ? get('dj_id') : djId;
        const date = get('date');
        const rawEventId = get('event_id');
        const flyerUrl = get('flyer_url');
        return {
          event_id: rawEventId || `${date || 'nodate'}__${get('venue') || 'novenue'}__${i}`,
          dj_id: rowDjId,
          date,
          event_name: get('event_name'),
          venue: get('venue'),
          location: get('location'),
          type: get('type'),
          status: get('status'),
          image_url: flyerUrl || null, // APIモードと呼び出し側インターフェースを揃えるための追加(既存のflyer_urlは維持)
          flyer_url: flyerUrl,
          memo: get('memo'),
        };
      })
      .filter((ev) => !!ev.date); // 日付が無い行は表示のしようがないので除外

    // 中央Eventsタブ方式（dj_id列あり）の場合のみ、djIdによる絞り込みを行う。
    // 個別タブ方式（dj_id列なし）では、シート自体が既にそのDJ専用なので絞り込み不要。
    if (hasSheetDjId && djId) {
      events = events.filter((ev) => ev.dj_id === djId);
    }

    if (statusFilter) {
      events = events.filter((ev) => ev.status.toLowerCase() === String(statusFilter).toLowerCase());
    }

    return events;
  }

  /* ============================================================
     F) メイン: fetchEvents
     ------------------------------------------------------------
     呼び出し時のoptionsで、APIモード / CSVモードを自動判定します:
       - options.slug がある（かつ csvUrl が無い） → APIモード
       - options.csvUrl がある                      → CSVモード（従来互換）

     引数:
       slug          : 【APIモード用】DJのslug（例: 'yu-x'）
       csvUrl        : 【CSVモード用】CSVとして取得できるURL
       djId          : 【CSVモード用】dj_id列が無いCSVで各行に付与するID(任意)。
                        APIモードでは無視されます（常に slug が dj_id として使われます）。
       statusFilter  : 【CSVモード用】この値と一致するstatusの行だけを残す（既定値 "active"）。
                        APIモードでは無視されます — 公開判定はAPI側の責務であり、
                        フロント側で再実装・再フィルタしないという方針のためです。

     返り値: Promise<Array<{
       event_id, dj_id, date, event_name, venue, location, type, status,
       image_url, flyer_url, memo
     }>>
       date昇順でソート済み（同日はモード内の取得順を維持する安定ソート）。
       image_url が正規フィールド、flyer_url はそれと同一値の後方互換エイリアスです
       （どちらか一方だけ未設定になることはなく、常に両方nullか両方同じURLです）。

     失敗時（fetch失敗・DJ不存在/非公開である404・必須列なし・0件等）は必ずrejectします。
     呼び出し側は .catch() で受け、既存の静的HTML（プレースホルダー）をそのまま残す
     フォールバックを行うこと（従来と同じ設計思想。API移行によってこの契約は変えていません）。
     ------------------------------------------------------------
     注: 出演時刻（start_time等）はこのスキーマでは扱いません（従来方針を踏襲）。
     ============================================================ */
  async function fetchEvents(options) {
    const {
      slug,
      csvUrl,
      djId = '',
      statusFilter = 'active',
    } = options || {};

    let events;
    if (csvUrl) {
      events = await fetchEventsFromCsv({ csvUrl, djId, statusFilter });
    } else if (slug) {
      events = await fetchEventsFromApi(slug);
    } else {
      throw new Error('fetchEvents: slug（APIモード）または csvUrl（CSVモード）のいずれかが必須です');
    }

    // 日付のみで昇順ソート（同日内の並び順は取得順を維持する安定ソート）
    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    return events;
  }

  /* ============================================================
     公開API（変更なし。formatDateParts/escapeHtmlのみ実装をCSPJUtilsへ委譲）
     ============================================================ */
  global.CSPJSchedule = {
    fetchEvents,
    buildSheetCsvUrl,
    formatDateParts,
    escapeHtml,
    extractDriveFileId,
    resolveDriveImageCandidates,
    loadFlyerImage,
    parseCSV, // 高度な用途向けに公開（通常はfetchEventsだけで足りる）
  };
})(window);
