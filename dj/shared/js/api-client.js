/**
 * CSPJ — Public API Client (common fetch layer)
 * /dj/shared/js/api-client.js
 *
 * 目的:
 *   公開API（api.cs-pj.com、認証不要・読み取り専用、リポジトリ `api.CSPJ_HP` で運用）への
 *   共通GET処理だけをここに置く。レスポンスの意味解釈（公開/非公開の判定・期限切れ判定等）は
 *   一切行わない — その判定はAPI側の責務であり、フロント側では再実装・再検証しない。
 *   ここで扱うのは「取得できたか／できなかったか」だけ。
 *
 *   各データ取得モジュール（schedule-data.js、将来の news-data.js / social-data.js /
 *   popup-data.js）は、必ずこの関数だけを経由してAPIへアクセスする。HTML生成・DOM操作は
 *   一切含まない（責務分離の方針は /dj/README.md を参照）。
 *
 * 読み込み順:
 *   APIモードを使うページでは、schedule-data.js より前に読み込むこと。
 *   <script src="/dj/shared/js/utils.js"></script>
 *   <script src="/dj/shared/js/api-client.js"></script>
 *   <script src="/dj/shared/js/schedule-data.js"></script>
 *
 *   CSVモードのみを使うページ（/dj/sample/ の技術サンプル等）では、このファイルは
 *   読み込む必要がない。
 */
(function (global) {
  'use strict';

  const DEFAULT_BASE_URL = 'https://api.cs-pj.com';

  /**
   * GET {baseUrl}{path} を叩き、JSONをパースして返す。
   *
   * 2xx以外は404を含めてすべてreject する（DJが存在しない／非公開である場合、APIの設計上
   * その配下の全endpointが404を返す。ここでは404を特別扱いせず、それ以外のエラー
   * （ネットワーク断・5xx等）と同じ「失敗」として扱う。呼び出し側は、既存の
   * `.catch()` で静的HTMLのプレースホルダーを維持するという共通のフォールバック
   * パターンに一律で乗せられる）。
   *
   * @param {string} path     '/v1/djs/yu-x/events' のような、APIのパス部分
   * @param {object} [options]
   * @param {string} [options.baseUrl] 既定は DEFAULT_BASE_URL
   * @returns {Promise<any>} パース済みJSON
   */
  async function getJson(path, options) {
    const { baseUrl = DEFAULT_BASE_URL } = options || {};
    const url = `${baseUrl}${path}`;

    let res;
    try {
      res = await fetch(url, { method: 'GET' });
    } catch (err) {
      throw new Error(`[CSPJApi] network error (${path}): ${err.message}`);
    }
    if (!res.ok) {
      throw new Error(`[CSPJApi] HTTP ${res.status} (${path})`);
    }
    return res.json();
  }

  /**
   * DJのslugを安全にURLへ組み込みつつ、`/v1/djs/:slug[/suffix]` の形のパスを組み立てる。
   * 例: djPath('yu-x') → '/v1/djs/yu-x'
   *     djPath('yu-x', 'events') → '/v1/djs/yu-x/events'
   */
  function djPath(slug, suffix) {
    const seg = encodeURIComponent(slug);
    return suffix ? `/v1/djs/${seg}/${suffix}` : `/v1/djs/${seg}`;
  }

  global.CSPJApi = {
    DEFAULT_BASE_URL,
    getJson,
    djPath,
  };
})(window);
