/**
 * Connect Spread PJ — /portal/dj/script.js
 * 完全に独立したスクリプトです。/portal/script.js・CSPJ本体・旧DJポータル・
 * 各DJページのJSとは無関係に動作します。
 *
 * 役割: 控えめなscroll revealのみ。DJカードは現状すべて静的な<a>/<div>で、
 * クリック時の追加処理(モーダル等)は無いため、それ以外のロジックはありません。
 * 将来、公開APIからDJ一覧を取得して .djp-grid[data-dj-grid] を描画する
 * initDjList() 等を追加する場合も、このrevealロジックの変更は不要な想定です。
 */
'use strict';

(function initReveal() {
  var targets = document.querySelectorAll('.reveal-fade, .reveal-up');
  if (!targets.length) return;

  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('revealed'); });
    return;
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  targets.forEach(function (el) { observer.observe(el); });
})();
