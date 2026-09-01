/**
 * CSPJ — Shared Schedule Data Layer
 * /dj/shared/js/schedule-data.js
 *
 * 目的:
 *   Google Sheets（を想定したCSVエンドポイント）から出演スケジュールを取得・正規化する
 *   「データ取得だけ」を共通化したモジュールです。
 *
 *   HTML生成・CSS・デザインは一切含みません。各DJページは、このモジュールが返す
 *   プレーンなJSオブジェクト配列を受け取り、完全に自由なHTML/CSSで描画してください。
 *
 * 使い方（最小構成）:
 *   <script src="/dj/shared/js/schedule-data.js"></script>
 *   <script>
 *     CSPJSchedule.fetchEvents({ csvUrl: 'https://docs.google.com/.../export?format=csv&gid=0' })
 *       .then(events => { ...自分のHTMLで描画... })
 *       .catch(err => { ...失敗時は静的HTMLのプレースホルダーをそのまま残す... });
 *   </script>
 *
 * 運用モデル（2026-08時点の設計）:
 *   DJごとに専用シート（専用タブ／専用gid）を持つ「個別タブ方式」を採用しています。
 *   Apps Scriptによる中央Events集約は行いません（詳細は /dj/README.md 参照）。
 *
 *   ただし将来「全DJ横断の中央Eventsタブ + dj_id列」方式へ移行しても、DJページ側の
 *   呼び出しコードを変更せずに済むよう、このモジュールは取得したCSVに dj_id 列が
 *   存在する場合は自動的にそれでフィルタし、存在しない場合は引数の djId をそのまま
 *   各イベントに付与するだけ、という両対応の設計にしてあります。
 */
(function (global) {
  'use strict';

  /* ============================================================
     A) CSVパーサー（RFC 4180準拠：ダブルクォート・カンマ・改行対応）
     DJ SENNA公式サイト（/js/main.js）の実装をベースにしています。
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
     ============================================================ */
  function buildSheetCsvUrl(sheetId, gid) {
    const g = (gid === undefined || gid === null || gid === '') ? '0' : gid;
    return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${g}`;
  }

  /* ============================================================
     C) "YYYY-MM-DD" → { year, month:"09", monthName:"SEP", day:"12" }
     ============================================================ */
  const MONTH_NAMES = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  function formatDateParts(dateStr) {
    const parts = (dateStr || '').split('-');
    if (parts.length < 3) return null;
    const [y, m, d] = parts;
    const monthIdx = parseInt(m, 10) - 1;
    if (isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return null;
    return {
      year: y,
      month: String(m).padStart(2, '0'),
      monthName: MONTH_NAMES[monthIdx],
      day: String(d).padStart(2, '0'),
    };
  }

  /* ============================================================
     D) HTMLエスケープ（外部入力＝スプレッドシートの値をinnerHTMLへ
        差し込む前に必ず通すこと。DJ本人やフォーム経由の入力を信用しない）
     ============================================================ */
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ============================================================
     E) Google DriveのファイルURLからFILE_IDを抽出（フライヤー画像用・任意）
        DJ SENNA公式サイトの実装をベースにしています。
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

  /** flyer_url（Driveの共有URLでも、それ以外の直リンク画像URLでもよい）から、
   *  実際にブラウザで読み込める画像URLをPromiseで返す汎用ユーティリティ。
   *
   *  試行順序:
   *    1. rawUrlがGoogle DriveのURL形式 → lh3.googleusercontent.com → drive.google.com/uc の順に試す
   *    2. Drive形式でない場合 → rawUrlをそのまま1回だけ試す
   *  すべて失敗した場合はreject。呼び出し側は「元のURLを新規タブで開く」等の
   *  外部リンクにフォールバックすること（画像そのものは表示できないだけで、
   *  リンク自体は生きている可能性があるため）。
   *
   *  DOM要素にもモーダルにも依存しない（<img>を裏で1つ生成して読み込み試験するだけ）ため、
   *  ボタンやモーダルの見た目はDJページ側で完全に自由に実装できる。 */
  function loadFlyerImage(rawUrl) {
    return new Promise((resolve, reject) => {
      if (!rawUrl) { reject(new Error('flyer_url is empty')); return; }

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
     F) メイン: fetchEvents
     ------------------------------------------------------------
     引数:
       csvUrl        : CSVとして取得できるURL（Google SheetsのCSVエクスポートURL、
                        もしくはローカルの.csvファイルなど。fetchできれば何でもよい）
       djId          : このDJの識別子（任意）。
                        - シートに dj_id 列がある場合 → その値でフィルタする
                        - dj_id 列が無い場合（個別タブ方式）→ 返却する各イベントに
                          そのまま付与するだけで、フィルタは行わない
       statusFilter  : この値と一致する status の行だけを残す（既定値 "active"）。
                        null / false を渡すとstatusによる絞り込みを無効化できる。

     返り値: Promise<Array<{
       event_id, dj_id, date, event_name,
       venue, location, type, status, flyer_url, memo
     }>>
       date昇順でソート済み（同日はシート内の行順を維持）。
       date列が空／不正な行は除外される。
       event_id列が無い場合は "date__venue__index" を仮のIDとして生成する。

       注: 出演時刻（start_time等）はこのスキーマでは扱いません。
       イベント確定時点でタイムテーブルが未確定なことが多い、1イベント内で
       同じDJが複数回出演するケースがある、といった理由から、正確な時刻は
       フライヤー画像を見てもらう運用としています（flyer_url参照）。
     ------------------------------------------------------------
     失敗時（fetch失敗・必須列なし・0件等）は必ずrejectする。
     呼び出し側は .catch() で受け、既存の静的HTML（プレースホルダー）を
     そのまま残すフォールバックを行うこと（SENNA公式サイトと同じ設計思想）。
     ============================================================ */
  const KNOWN_COLUMNS = [
    'event_id', 'dj_id', 'date', 'event_name',
    'venue', 'location', 'type', 'status', 'flyer_url', 'memo',
  ];

  async function fetchEvents(options) {
    const {
      csvUrl,
      djId = '',
      statusFilter = 'active',
    } = options || {};

    if (!csvUrl) throw new Error('fetchEvents: csvUrl は必須です');

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
        return {
          event_id: rawEventId || `${date || 'nodate'}__${get('venue') || 'novenue'}__${i}`,
          dj_id: rowDjId,
          date,
          event_name: get('event_name'),
          venue: get('venue'),
          location: get('location'),
          type: get('type'),
          status: get('status'),
          flyer_url: get('flyer_url'),
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

    // 日付のみで昇順ソート（同日内の並び順はシート内の行順を維持する安定ソート）
    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    return events;
  }

  /* ============================================================
     公開API
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
