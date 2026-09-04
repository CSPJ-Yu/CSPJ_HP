/**
 * Connect Spread PJ — /portal/script.js
 * 完全に独立したスクリプトです。CSPJ本体・DJポータル・各DJページの
 * JSとは無関係に動作します。
 *
 * 役割: 控えめなscroll revealのみ。DJ/EVENT/WORKS/SHOPカードは今回すべて
 * 非インタラクティブな<div>のため、クリック/開閉等のロジックはありません
 * (次フェーズで/portal/dj/が完成し、DJカードを<a>化した際もこのスクリプトの
 * 変更は不要です)。
 */
'use strict';

(function initReveal() {
  var targets = document.querySelectorAll('.reveal-fade, .reveal-up');
  if (!targets.length) return;

  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    // アニメーションなしで即座に表示する(reduced-motion環境やIO非対応環境向け)
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
