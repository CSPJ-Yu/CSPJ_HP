/**
 * CSPJ — DJ Genre 公開データ取得モジュール
 * /dj/shared/js/genre-data.js
 *
 * 目的:
 *   公開API（api.cs-pj.com）からDJのMain Genreを取得・正規化するだけの層。
 *   HTML生成・DOM操作は一切含まない（責務分離の方針は /dj/README.md 参照）。
 *
 * 確認済みAPI仕様（2026-09、api.cs-pj.com 実レスポンスより）:
 *   GET https://api.cs-pj.com/v1/djs/:slug/genres
 *   200: { "genres": {
 *     "main": { "slug": string, "name": string } | null,
 *     "sub":  [ { "slug": string, "name": string }, ... ]
 *   } }
 *   404: DJが存在しない/非公開、またはGenre自体が未登録の場合
 *        （schedule-data.js・popup-data.js等と同じ挙動）。
 *
 *   Sub Genre（`genres.sub`）は取得はするが、このモジュールでは正規化・公開
 *   しない（Portal Cardに表示するのはMain Genre 1件のみという今回の仕様に
 *   合わせ、responseの取り扱いを最小限にする）。将来Sub Genreを使う用途が
 *   できた場合は、このモジュールを拡張すること。
 *
 * 読み込み順:
 *   <script src="/dj/shared/js/utils.js"></script>
 *   <script src="/dj/shared/js/api-client.js"></script>
 *   <script src="/dj/shared/js/genre-data.js"></script>
 */
(function (global) {
  'use strict';

  /**
   * @param {string} slug DJのslug（例: 'yu-x'）
   * @returns {Promise<{slug: string, name: string}|null>}
   *          Main Genreが取得できない場合（404、genres.main が null、
   *          nameが空文字等）は null で解決する（rejectしない — Genre は
   *          あくまでoptional情報であり、呼び出し側はnullチェックのみで
   *          「Genre行自体を生成しない」を選べればよいため。
   *          profile-data.js・popup-data.jsと同じ設計）。
   */
  async function fetchMainGenre(slug) {
    let data;
    try {
      data = await CSPJApi.getJson(CSPJApi.djPath(slug, 'genres'));
    } catch (err) {
      return null; // 404・ネットワークエラー等はすべて「Main Genreなし」として扱う
    }

    const main = data && data.genres && data.genres.main;
    if (!main || !main.name) return null;

    return {
      slug: main.slug || '',
      name: main.name,
    };
  }

  global.CSPJGenreData = { fetchMainGenre };
})(window);
