/**
 * DJ NAO — PROFILE page script(専用・独立)
 * /dj/nao/profile/script.js
 *
 * このファイルは /dj/nao/profile/ 専用です。/dj/nao/script.js
 * (TOP/NEWS/SCHEDULEが使う共通スクリプト)には依存せず、
 * このファイルの変更が他ページの挙動に影響することはありません。
 *
 * 【CSPJ Proプランの設計方針】
 *   「データ取得」は /dj/shared/js/ の共通モジュール(CSPJ全DJ共通の
 *   Public API接続層)をそのまま再利用し、「DOM生成・見た目」だけを
 *   このページ専用に自由実装する、という責務分離を徹底する。
 *   このページで使うのは utils.js / api-client.js / profile-data.js /
 *   social-data.js のみ(NEWS/SCHEDULE/POPUPはこのページに無いため未読込)。
 */
'use strict';

// {{SLUG}} に相当する正式識別子。Public APIへの問い合わせは常にこの1箇所を参照する。
const DJ_SLUG = 'nao';

(function initMobileNav() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('siteNav');
  if (!toggle || !nav) return;

  let isOpen = false;

  function setOpen(open) {
    isOpen = open;
    nav.classList.toggle('is-open', open);
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }

  toggle.addEventListener('click', () => setOpen(!isOpen));
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setOpen(false)));

  document.addEventListener('click', (e) => {
    if (isOpen && !toggle.contains(e.target) && !nav.contains(e.target)) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      setOpen(false);
      toggle.focus();
    }
  });
})();

(function initReveal() {
  const targets = document.querySelectorAll('.profBox, .page-banner');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('reveal-in'));
    return;
  }

  targets.forEach((el) => el.classList.add('reveal-ready'));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  targets.forEach((el) => observer.observe(el));
})();

/* ============================================================
   Profile — CSPJ共通データ取得モジュール(/dj/shared/js/profile-data.js)を
   本番の公開API接続で使用する(GET https://api.cs-pj.com/v1/djs/nao)。

   Manage/D1側にNAOが未登録の間は404が返り、[data-dj-name]/[data-dj-logo]/
   [data-dj-photo]は静的HTMLのプレースホルダー(「NAO」表記・ロゴ画像・PHOTO枠)を
   そのまま維持する。登録が完了すれば、このスクリプトの変更なしに自動で
   実データへ切り替わる(TOPページのscript.jsと同じ設計)。
   ============================================================ */
(function initProfile() {
  if (!window.CSPJProfile) return;
  const nameTargets = document.querySelectorAll('[data-dj-name]');
  const logoTargets = document.querySelectorAll('[data-dj-logo]');
  const photoTargets = document.querySelectorAll('[data-dj-photo]');
  if (!nameTargets.length && !logoTargets.length && !photoTargets.length) return;

  CSPJProfile.fetchProfile(DJ_SLUG)
    .then((profile) => {
      if (!profile) return; // 取得失敗時は静的表記を維持

      if (profile.display_name) {
        nameTargets.forEach((el) => { el.textContent = profile.display_name; });
        logoTargets.forEach((img) => {
          img.alt = profile.display_name;
          if (img.parentElement) img.parentElement.setAttribute('aria-label', profile.display_name);
        });
      }

      if (profile.portal_card_image_url) {
        photoTargets.forEach((el) => {
          el.innerHTML = '';
          const img = document.createElement('img');
          img.src = profile.portal_card_image_url;
          img.alt = profile.display_name ? `${profile.display_name}の写真` : 'プロフィール写真';
          el.appendChild(img);
        });
      }
    })
    .catch((err) => {
      console.warn('[Profile] 読み込み失敗 → 静的HTMLの表記を維持:', err.message);
    });
})();

/* ============================================================
   SNS LINKS — CSPJ共通データ取得モジュール(/dj/shared/js/social-data.js)を
   本番の公開API接続(GET https://api.cs-pj.com/v1/djs/nao/social-links)で使用する。

   アイコンはブランドロゴ画像を使わず、このページ専用のモノラインSVG
   (ICONS定数)で表現する。0件・取得失敗時は静的なプレースホルダーを維持する。
   ============================================================ */
(function initSocialLinks() {
  const container = document.querySelector('[data-social-list]');
  if (!container || !window.CSPJSocialData) return;

  const SERVICE_LABELS = {
    instagram: 'Instagram',
    x: 'X',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    facebook: 'Facebook',
    threads: 'Threads',
  };

  // 簡易モノラインアイコン(独自制作。各ブランドの公式ロゴ画像は使用していない)。
  const ICONS = {
    instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="0.6" fill="currentColor" stroke="none"/>',
    x: '<path d="M4.5 4.5L19.5 19.5M19.5 4.5L4.5 19.5"/>',
    tiktok: '<path d="M14 4v9.5a3.2 3.2 0 1 1-3.2-3.2c.3 0 .6 0 .9.1"/><path d="M14 4c.3 2 1.9 3.5 4 3.7"/>',
    youtube: '<rect x="3" y="6.5" width="18" height="11" rx="3.5"/><path d="M10.5 9.5l4 2.5-4 2.5z" fill="currentColor" stroke="none"/>',
    facebook: '<circle cx="12" cy="12" r="8.5"/><path d="M13.2 20v-6.3h2l.3-2.4h-2.3V9.7c0-.7.2-1.2 1.2-1.2h1.3V6.3c-.2 0-1-.1-1.9-.1-1.9 0-3.1 1.1-3.1 3.2v1.9H8.7v2.4h2v6.3"/>',
    threads: '<path d="M8 8.5c1-.7 2.2-1 3.6-1 3 0 5 1.8 5 5.2 0 3.7-2.4 5.8-5.6 5.8-2.6 0-4.5-1.3-4.5-3.4 0-2 2-3 4.6-3 .9 0 1.8.1 2.5.4"/>',
  };

  CSPJSocialData.fetchSocialLinks(DJ_SLUG)
    .then((links) => {
      if (!links.length) return; // 0件なら静的プレースホルダー(Coming Soon)を維持

      const list = document.createElement('div');
      list.className = 'profBox__sns';
      links.forEach((link) => list.appendChild(renderIcon(link)));

      container.innerHTML = '';
      container.appendChild(list);

      console.log(
        `%c[Social] ${links.length}件を公開APIから読み込みました`,
        'color:#ff1493; font-weight:bold;'
      );
    })
    .catch((err) => {
      console.warn('[Social] 読み込み失敗 → 静的HTMLのプレースホルダーを維持:', err.message);
    });

  function renderIcon(link) {
    const displayLabel = link.label || SERVICE_LABELS[link.service] || link.service;
    const path = ICONS[link.service];

    const a = document.createElement('a');
    a.className = 'sns-icon';
    a.href = link.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('aria-label', displayLabel);

    if (path) {
      a.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
    } else {
      // 未知のservice値(other等でアイコン未定義)の場合はテキストのみで安全に表示する。
      a.textContent = displayLabel.slice(0, 2).toUpperCase();
    }

    return a;
  }
})();
