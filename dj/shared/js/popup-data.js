/**
 * CSPJ — POPUP 公開データ取得モジュール
 * /dj/shared/js/popup-data.js
 *
 * 目的:
 *   公開API（api.cs-pj.com）から「現在有効なPOPUP」を1件取得・正規化するだけの層。
 *   HTML生成・DOM操作・モーダルの開閉は一切含まない。表示自体は各DJページの
 *   window.CSPJPopup.open()（DJページ固有・作り直さない）が担当する。
 *
 *   グローバル名を CSPJPopupData としているのは、各DJページ側の
 *   window.CSPJPopup（モーダルDOM/開閉処理）と名前が衝突しないようにするため。
 *
 * 確認済みAPI仕様（2026-09、api.cs-pj.com 実レスポンスより）:
 *   GET https://api.cs-pj.com/v1/djs/:slug/popup
 *   200: { "popup": {
 *     popup_id: string,
 *     title: string,
 *     body: string,
 *     link_url: string | null,
 *     link_label: string | null,
 *     image_url: string | null,
 *     expires_at: "YYYY-MM-DD HH:MM:SS" | null
 *   } }
 *   404: DJが存在しない/非公開、またはPOPUP自体が無い場合
 *        （schedule-data.js・api-client.jsと同じ挙動）。
 *
 *   注記: 事前の想定仕様にあった真偽値 `enabled` は実際のレスポンスには
 *   存在しない。レスポンスに popup オブジェクトが含まれること自体が
 *   「現在表示してよいPOPUPがある」ことを意味する契約として扱う
 *   （404の場合と合わせ、fetchPopup()は「表示すべきPOPUPが無い」場合に
 *   一律nullを返す）。
 *
 *   `expires_at` が過去日時の場合は、念のためクライアント側でも表示しない
 *   （API側が既に絞り込んでいる可能性が高いが、二重の安全策として）。
 *
 *   実際のレスポンスには `link_url` / `link_label`（関連リンク）も含まれるが、
 *   既存の window.CSPJPopup のモーダルDOMにリンク表示欄が無く、今回はモーダル
 *   のDOM構造を変更しない方針のため、このモジュールは正規化して返すのみとし、
 *   描画側では使用しない。
 *
 * 読み込み順:
 *   <script src="/dj/shared/js/utils.js"></script>
 *   <script src="/dj/shared/js/api-client.js"></script>
 *   <script src="/dj/shared/js/popup-data.js"></script>
 */
(function (global) {
  'use strict';

  /**
   * @param {string} slug DJのslug（例: 'yu-x'）
   * @returns {Promise<{popup_id, title, body, link_url, link_label, image_url, expires_at}|null>}
   *          表示すべきPOPUPが無い場合（404、popupが空、期限切れ）はnullで解決する
   *          （rejectしない — 呼び出し側は「何もしない」の一択でよいため）。
   */
  async function fetchPopup(slug) {
    let data;
    try {
      data = await CSPJApi.getJson(CSPJApi.djPath(slug, 'popup'));
    } catch (err) {
      return null; // 404を含め、取得できない場合は「POPUPなし」として扱う
    }

    const popup = data && data.popup;
    if (!popup || !popup.title) return null;

    if (popup.expires_at) {
      const expiresAt = Date.parse(String(popup.expires_at).replace(' ', 'T'));
      if (!isNaN(expiresAt) && expiresAt < Date.now()) return null;
    }

    return {
      popup_id: popup.popup_id,
      title: popup.title || '',
      body: popup.body || '',
      link_url: popup.link_url || null,
      link_label: popup.link_label || null,
      image_url: popup.image_url || null,
      expires_at: popup.expires_at || null,
    };
  }

  global.CSPJPopupData = { fetchPopup };
})(window);
