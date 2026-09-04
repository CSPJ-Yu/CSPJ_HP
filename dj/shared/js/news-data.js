/**
 * CSPJ — NEWS 公開データ取得モジュール
 * /dj/shared/js/news-data.js
 *
 * 目的:
 *   公開API（api.cs-pj.com）からNEWS一覧を取得・正規化するだけの層。
 *   HTML生成・DOM操作は一切含まない（責務分離の方針は /dj/README.md 参照）。
 *   各DJページの script.js 側の initNews() が、このモジュールから受け取った
 *   配列をどう描画するかを100%自由に決める。
 *
 * 確認済みAPI仕様（2026-09、api.cs-pj.com 実レスポンスより）:
 *   GET https://api.cs-pj.com/v1/djs/:slug/news
 *   200: { "news": [
 *     {
 *       news_id: string,
 *       title: string,
 *       body: string,
 *       publish_date: "YYYY-MM-DD HH:MM:SS",
 *       image_url: string | null,
 *       links: [{ label: string, url: string }, ...]   // 任意の関連リンク配列
 *     }, ...
 *   ] }
 *   404: DJが存在しない/非公開の場合（schedule-data.js・api-client.jsと同じ挙動）。
 *
 *   公開/非公開の絞り込みはAPI側の責務で、返ってきた配列はすべて表示対象として
 *   扱ってよい（フロント側で再フィルタしない）。
 *
 *   注記: 実際のレスポンスには `links`（関連リンク）フィールドが含まれるが、
 *   今回のNEWS表示要件（タイトル・本文・公開日・画像）には含まれていないため、
 *   このモジュールは正規化した形でそのまま返すのみとし、描画側(script.js)は
 *   今回 links を使用しない。
 *
 * 読み込み順:
 *   <script src="/dj/shared/js/utils.js"></script>
 *   <script src="/dj/shared/js/api-client.js"></script>
 *   <script src="/dj/shared/js/news-data.js"></script>
 */
(function (global) {
  'use strict';

  /**
   * @param {string} slug DJのslug（例: 'yu-x'）
   * @returns {Promise<Array<{news_id, title, body, publish_date, image_url, links}>>}
   *          公開日(publish_date)の降順（新しい順）でソート済み。
   *          取得失敗（404含む）はrejectする — 呼び出し側の.catch()で
   *          既存の静的HTML（プレースホルダー）を維持すること。
   */
  async function fetchNews(slug) {
    const data = await CSPJApi.getJson(CSPJApi.djPath(slug, 'news'));
    const list = Array.isArray(data && data.news) ? data.news : [];

    return list
      .map((row) => ({
        news_id: row.news_id,
        title: row.title || '',
        body: row.body || '',
        publish_date: row.publish_date || '',
        image_url: row.image_url || null,
        links: Array.isArray(row.links) ? row.links : [],
      }))
      .sort((a, b) => {
        const ta = Date.parse(String(a.publish_date).replace(' ', 'T'));
        const tb = Date.parse(String(b.publish_date).replace(' ', 'T'));
        return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
      });
  }

  global.CSPJNews = { fetchNews };
})(window);
