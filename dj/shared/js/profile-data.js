/**
 * CSPJ — DJ Profile 公開データ取得モジュール
 * /dj/shared/js/profile-data.js
 *
 * 目的:
 *   公開API（api.cs-pj.com）からDJの基本プロフィールを取得・正規化するだけの層。
 *   HTML生成・DOM操作は一切含まない（責務分離の方針は /dj/README.md 参照）。
 *
 * 確認済みAPI仕様（2026-09、api.cs-pj.com 実レスポンスより）:
 *   GET https://api.cs-pj.com/v1/djs/:slug
 *   200: { "slug": string, "display_name": string }
 *   404: DJが存在しない/非公開の場合（schedule-data.js等と同じ挙動）。
 *
 *   【重要・API側の制約】cspj-manage側のdjsテーブルには slug / display_name /
 *   status 以外のカラムが存在せず、公開APIも slug / display_name の2項目しか
 *   返さない。Bio・Genre・location はAPI側にデータ自体が存在しないため、
 *   このモジュールは display_name（と参照用の slug）のみを返す。これらの項目を
 *   推測して追加してはならない（API側の仕様が拡張された場合のみ、このモジュールを
 *   拡張すること）。
 *
 *   【2026-09追加・Portal Card画像対応】将来、公開APIのレスポンスに
 *   `portal_card_image_url`（Portal Card専用画像。Freeプランでは無料HP側の
 *   プロフィール画像としても共通利用される想定。詳細は /dj/README.md 参照）が
 *   追加される見込みのため、optionalフィールドとして先行対応する。現時点の
 *   実レスポンスにはまだこのフィールドが存在しないため、常に null を返す
 *   (存在しないことをエラーにはしない)。フィールドが追加され次第、
 *   このモジュールを変更しなくても自動的に反映される。
 *
 * 読み込み順:
 *   <script src="/dj/shared/js/utils.js"></script>
 *   <script src="/dj/shared/js/api-client.js"></script>
 *   <script src="/dj/shared/js/profile-data.js"></script>
 */
(function (global) {
  'use strict';

  /** http/https の絶対URLかどうかを確認する（social-data.jsと同じ防御的チェック）。 */
  function isValidHttpUrl(value) {
    if (!value) return false;
    try {
      var u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (err) {
      return false;
    }
  }

  /**
   * @param {string} slug DJのslug（例: 'yu-x'）
   * @returns {Promise<{slug, display_name, portal_card_image_url}|null>}
   *          取得失敗（404含む）・display_name が空の場合は null で解決する
   *          （rejectしない — 呼び出し側は「取得できなければ静的HTMLの表記を
   *          そのまま維持する」の一択でよいため。popup-data.jsと同じ設計）。
   *          portal_card_image_url は未対応API・値が無い・不正なURLの
   *          いずれの場合も null（呼び出し側は null チェックのみでよい）。
   */
  async function fetchProfile(slug) {
    let data;
    try {
      data = await CSPJApi.getJson(CSPJApi.djPath(slug));
    } catch (err) {
      return null; // 404を含め、取得できない場合は「プロフィールなし」として扱う
    }

    if (!data || !data.display_name) return null;

    return {
      slug: data.slug || slug,
      display_name: data.display_name,
      portal_card_image_url: isValidHttpUrl(data.portal_card_image_url)
        ? data.portal_card_image_url
        : null,
    };
  }

  global.CSPJProfile = { fetchProfile };
})(window);
