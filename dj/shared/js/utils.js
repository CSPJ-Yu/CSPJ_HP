/**
 * CSPJ — Shared, data-source-independent utilities
 * /dj/shared/js/utils.js
 *
 * 目的:
 *   データの取得元（CSV / 公開API）に依存しない共通処理だけを置く。
 *   これまで /dj/shared/js/schedule-data.js に同居していた formatDateParts() /
 *   escapeHtml() を分離したもの（2026-09 公開API移行の一環）。
 *
 *   schedule-data.js（および将来の news-data.js / social-data.js / popup-data.js）は、
 *   ここに置かれた関数を呼び出す側であり、このファイル自体はCSV/APIどちらの知識も持たない。
 *
 * 読み込み順:
 *   このファイルは schedule-data.js より前に読み込むこと。
 *   <script src="/dj/shared/js/utils.js"></script>
 *   <script src="/dj/shared/js/schedule-data.js"></script>
 */
(function (global) {
  'use strict';

  const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  /** "YYYY-MM-DD" → { year, month:"09", monthName:"SEP", day:"12" }。不正な形式はnull。 */
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

  /** 外部入力（CSV/APIいずれの由来でも）をinnerHTMLへ差し込む前に必ず通すこと（XSS対策）。 */
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  global.CSPJUtils = {
    formatDateParts,
    escapeHtml,
  };
})(window);
