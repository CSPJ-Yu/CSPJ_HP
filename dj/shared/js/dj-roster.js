/**
 * CSPJ — DJロスター(既知slug一覧)モジュール
 * /dj/shared/js/dj-roster.js
 *
 * 【重要・暫定実装であることの明記】
 *   公開API(api.cs-pj.com)には、2026-09時点で「DJ一覧を返すendpoint」
 *   (例: GET /v1/djs)が存在しない(実際にリクエストし404であることを確認済み)。
 *   そのため、「どのDJが存在するか」という一覧そのものだけは、この暫定的な
 *   静的配列で管理する(以前の /dj/index.html の .dj-grid が手動更新だった
 *   のと同じ考え方を踏襲している)。
 *
 *   ここで管理するのはslugの一覧のみで、DJの表示名・ジャンル・画像等の
 *   コンテンツは一切含まない(推測データを持たない)。実際のコンテンツは、
 *   この一覧の各slugについて公開API(GET /v1/djs/:slug、
 *   dj/shared/js/profile-data.js の CSPJProfile.fetchProfile)から取得する。
 *   取得に失敗したslug(非公開化・削除等)は、呼び出し側で自然に除外される
 *   (profile-data.jsがnull/rejectを返す設計のため、このモジュール側では
 *   何もハンドリングしない)。
 *
 *   /dj/sample/ は技術サンプルであり実在のDJではないため、意図的にここへ
 *   含めていない。
 *
 * 【将来】公開API側に一覧取得endpointが実装された場合、listKnownSlugs()の
 *   中身をそのAPI呼び出しに差し替えるだけでよい。呼び出し側
 *   (portal/dj/script.js)のコードは変更不要な設計にしてある。
 *
 * 読み込み順:
 *   このファイル自体は他の共有モジュールに依存しない(単純な配列を返すのみ)。
 *   <script src="/dj/shared/js/dj-roster.js"></script>
 */
(function (global) {
  'use strict';

  // 実在するDJのslugのみを追加すること。新しいDJサイト(/dj/<slug>/)を
  // 追加した際は、ここにも忘れずに追加する(現状はこれが唯一の登録箇所)。
  var KNOWN_DJ_SLUGS = ['yu-x'];

  /** @returns {string[]} 既知のDJ slug一覧のコピー(呼び出し側が変更しても内部状態に影響しない)。 */
  function listKnownSlugs() {
    return KNOWN_DJ_SLUGS.slice();
  }

  global.CSPJDjRoster = { listKnownSlugs };
})(window);
