/**
 * CSPJ — SNS LINKS 公開データ取得モジュール
 * /dj/shared/js/social-data.js
 *
 * 目的:
 *   公開API（api.cs-pj.com）からSNS LINKS一覧を取得・正規化するだけの層。
 *   HTML生成・DOM操作・プラットフォームごとの表示名決定は一切含まない
 *   （表示名は各DJページ側の定数マッピングが担当。責務分離の方針は
 *   /dj/README.md 参照）。
 *
 * 確認済みAPI仕様（2026-09、api.cs-pj.com 実レスポンスより）:
 *   GET https://api.cs-pj.com/v1/djs/:slug/social-links
 *   200: { "social_links": [
 *     { service: string, label: string|null, url: string }, ...
 *   ] }
 *   404: DJが存在しない/非公開の場合（schedule-data.js等と同じ挙動）。
 *
 *   service の実際の許容値（cspj-manage側 migrations/0007_social_links.sql の
 *   CHECK制約と一致）: 'instagram' | 'x' | 'tiktok' | 'youtube' | 'facebook' |
 *   'threads' | 'other'。SoundCloud/Mixcloud等、これ以外の値は現在のスキーマには
 *   存在しない。
 *
 *   label は service='other' の場合のみ値を持つ（標準SNSはDB側で常にNULLとし、
 *   表示名はフロント側の定数で決定する設計。db側のCHECK制約でも強制されている）。
 *
 *   このテーブルには「表示ON/OFF」を示す真偽値カラムは存在しない。SNSリンクは
 *   登録されていれば表示対象、登録されていなければ配列に含まれない、という
 *   「行の存在＝表示」の設計のため、このモジュールは取得できた行をすべて
 *   正規化して返す（フロント側で追加のフィルタは行わない）。
 *
 *   URLが空文字列、またはhttp/https以外のスキームの場合は、不正なデータとして
 *   安全に除外する（防御的措置。API側で既に保証されている想定だが二重に確認する）。
 *
 * 読み込み順:
 *   <script src="/dj/shared/js/utils.js"></script>
 *   <script src="/dj/shared/js/api-client.js"></script>
 *   <script src="/dj/shared/js/social-data.js"></script>
 */
(function (global) {
  'use strict';

  function isValidHttpUrl(value) {
    if (!value) return false;
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (err) {
      return false;
    }
  }

  /**
   * @param {string} slug DJのslug（例: 'yu-x'）
   * @returns {Promise<Array<{service, label, url}>>}
   *          登録順（API側でcreated_at昇順）。
   *          取得失敗（404含む）はrejectする — 呼び出し側の.catch()で
   *          既存の静的HTML（プレースホルダー）を維持すること
   *          （schedule-data.js・news-data.jsと同じ契約）。
   */
  async function fetchSocialLinks(slug) {
    const data = await CSPJApi.getJson(CSPJApi.djPath(slug, 'social-links'));
    const list = Array.isArray(data && data.social_links) ? data.social_links : [];

    return list
      .map((row) => ({
        service: row.service || '',
        label: row.label || null,
        url: row.url || '',
      }))
      .filter((row) => !!row.service && isValidHttpUrl(row.url));
  }

  global.CSPJSocialData = { fetchSocialLinks };
})(window);
