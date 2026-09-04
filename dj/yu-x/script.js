/**
 * YU-X — /dj/yu-x/script.js
 * 完全に独立したスクリプトです。CSPJ本体・DJポータル・/dj/sample/ の
 * JSとは無関係に動作します。
 */
'use strict';

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

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  document.addEventListener('click', (e) => {
    if (isOpen && !toggle.contains(e.target) && !nav.contains(e.target)) {
      setOpen(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      setOpen(false);
      toggle.focus();
    }
  });
})();

/* Simple on-scroll fade-in for sections (self-contained, no external deps) */
(function initReveal() {
  const targets = document.querySelectorAll('main section');
  if (!targets.length || !('IntersectionObserver' in window)) return;

  targets.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  targets.forEach((el) => observer.observe(el));
})();

/* ============================================================
   Schedule — CSPJ共通データ取得モジュール(/dj/shared/js/schedule-data.js)を
   本番の公開API接続(APIモード)で使用する。

   CSPJSchedule.fetchEvents({ slug: 'yu-x' }) は内部で
   GET https://api.cs-pj.com/v1/djs/yu-x/events を呼び出す
   (/dj/shared/js/api-client.js 経由。公開/非公開判定はAPI側の責務)。

   取得できない場合(ネットワークエラー・DJ不存在等)は、
   index.html に書かれた静的HTML(準備中メッセージ)をそのまま残す。
   ============================================================ */
(function initSchedule() {
  const list = document.querySelector('.schedule__list');
  if (!list || !window.CSPJSchedule) return;

  CSPJSchedule.fetchEvents({ slug: 'yu-x' })
    .then((events) => {
      if (!events.length) return; // 0件なら静的プレースホルダーを維持

      list.innerHTML = '';
      events.forEach((ev) => list.appendChild(renderScheduleItem(ev)));

      console.log(
        `%c[Schedule] ${events.length}件を公開APIから読み込みました`,
        'color:#9ad; font-weight:bold;'
      );
    })
    .catch((err) => {
      console.warn('[Schedule] 読み込み失敗 → 静的HTMLのプレースホルダーを維持:', err.message);
    });

  // 表示のみを「DATE / EVENT・VENUE・LOCATION / TAG・FLYER」の3ブロックに
  // 分けて情報階層を明確にしている(正式デザイン反映)。fetchEvents()が返す
  // データ自体・各フィールドの意味・Flyer Modalの処理は変更していない。
  function renderScheduleItem(ev) {
    const { escapeHtml, formatDateParts } = CSPJSchedule;
    const d = formatDateParts(ev.date);
    const dateMd = d ? `${d.month}.${d.day}` : ev.date;
    const dateY = d ? d.year : '';

    const infoParts = [];
    if (ev.event_name) infoParts.push(`<span class="schedule__event">${escapeHtml(ev.event_name)}</span>`);
    if (ev.venue) infoParts.push(`<span class="schedule__venue">${escapeHtml(ev.venue)}</span>`);
    if (ev.location) infoParts.push(`<span class="schedule__location">${escapeHtml(ev.location)}</span>`);

    const li = document.createElement('li');
    li.className = 'schedule__item';
    li.innerHTML = `
      <div class="schedule__date">
        <span class="schedule__date-md">${escapeHtml(dateMd)}</span>
        <span class="schedule__date-y">${escapeHtml(dateY)}</span>
      </div>
      <div class="schedule__info">${infoParts.join('')}</div>
      <div class="schedule__aside">
        <span class="schedule__tag">${escapeHtml((ev.type || 'EVENT').toUpperCase())}</span>
      </div>
    `;

    // image_url(正規フィールド。flyer_urlは互換エイリアス)がある行だけ
    // 「FLYERを見る」ボタンを追加する。ボタンの見た目・モーダルはこのDJページ
    // 独自の実装で、共通層(schedule-data.js)は画像URLの解決までしか担当しない。
    const flyerSrc = ev.image_url || ev.flyer_url;
    if (flyerSrc) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'schedule__flyer-btn';
      btn.textContent = 'FLYERを見る';
      btn.addEventListener('click', () => openFlyerModal(flyerSrc));
      li.querySelector('.schedule__aside').appendChild(btn);
    }

    return li;
  }
})();

/* ============================================================
   Flyer Modal — 「FLYERを見る」ボタンから開くモーダル。
   このDJページ独自のHTML/CSS/挙動。画像URLの解決は共通層の
   CSPJSchedule.loadFlyerImage() に完全に委譲する。
   ============================================================ */
(function initFlyerModal() {
  if (!window.CSPJSchedule) return;

  let modal = null;

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'flyer-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'フライヤー');
    modal.innerHTML = `
      <div class="flyer-modal__inner">
        <button type="button" class="flyer-modal__close" aria-label="閉じる">✕</button>
        <p class="flyer-modal__status">Loading…</p>
        <img class="flyer-modal__img" alt="フライヤー" style="display:none;">
        <a class="flyer-modal__fallback" href="#" target="_blank" rel="noopener" style="display:none;">元のURLを開く ↗</a>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.flyer-modal__close').addEventListener('click', closeFlyerModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeFlyerModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeFlyerModal();
    });

    return modal;
  }

  function closeFlyerModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  window.openFlyerModal = function openFlyerModal(rawUrl) {
    const m = ensureModal();
    const status = m.querySelector('.flyer-modal__status');
    const img = m.querySelector('.flyer-modal__img');
    const fallback = m.querySelector('.flyer-modal__fallback');

    img.style.display = 'none';
    img.removeAttribute('src');
    fallback.style.display = 'none';
    status.style.display = 'block';
    status.textContent = 'Loading…';

    m.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    m.querySelector('.flyer-modal__close').focus();

    CSPJSchedule.loadFlyerImage(rawUrl)
      .then((workingUrl) => {
        status.style.display = 'none';
        img.src = workingUrl;
        img.style.display = 'block';
      })
      .catch((err) => {
        console.warn('[Flyer] 画像の読み込みに失敗 → 外部リンクへフォールバック:', err.message);
        status.style.display = 'none';
        fallback.href = rawUrl;
        fallback.style.display = 'inline-block';
      });
  };
})();

/* ============================================================
   NEWS — 現時点では公開APIに接続していない(土台のみ)。
   .news__list (data-news-list) に「Coming Soon」を静的表示しているだけで、
   動的な初期化処理は無い。将来ここに initNews() を追加し、
   { title, body, image(任意), published_at } の配列を取得して
   .news__item / .news__item--with-image を描画する想定
   (SCHEDULE以外のAPI URLを推測実装しないという方針のため、今回は未実装)。
   ============================================================ */

/* ============================================================
   SNS LINKS — 現時点では公開APIに接続していない(土台のみ)。
   .social__list (data-social-list) に「Coming Soon」を静的表示しているだけ。
   将来ここに initSocialLinks() を追加し、{ platform, url, enabled } の配列から
   enabled=true の項目だけを .social__link として描画する想定
   (架空のURLは今回設定していない)。
   ============================================================ */

/* ============================================================
   Popup — 将来のAPI接続に備えた最小限の土台。Flyer Modalとは
   DOM・クラス名・実装を完全に分離している(用途が異なるため)。

   今回はAPI未接続のため、ページ読み込み時に自動的に開くことはない。
   表示条件・頻度制御(Cookie等による「1日1回だけ表示」等)も今回は対象外。
   将来、POPUP用の公開APIから取得したデータをそのまま
   window.CSPJPopup.open({ title, body, image }) に渡せば表示できる。
   ============================================================ */
(function initPopup() {
  let modal = null;
  let lastFocused = null;

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'popup-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'popup-modal-title');
    modal.setAttribute('aria-describedby', 'popup-modal-body');
    modal.innerHTML = `
      <div class="popup-modal__inner">
        <button type="button" class="popup-modal__close" aria-label="閉じる">✕</button>
        <span class="popup-modal__label" aria-hidden="true">Notice</span>
        <img class="popup-modal__img" alt="" style="display:none;">
        <h2 class="popup-modal__title" id="popup-modal-title"></h2>
        <p class="popup-modal__body" id="popup-modal-body"></p>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.popup-modal__close').addEventListener('click', closePopup);
    modal.addEventListener('click', (e) => { if (e.target === modal) closePopup(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closePopup();
    });

    return modal;
  }

  function closePopup() {
    if (!modal || !modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  // data: { title, body, image(任意) }。textContentで挿入するためHTMLエスケープ不要。
  function openPopup(data) {
    const m = ensureModal();
    const titleEl = m.querySelector('.popup-modal__title');
    const bodyEl = m.querySelector('.popup-modal__body');
    const imgEl = m.querySelector('.popup-modal__img');

    titleEl.textContent = (data && data.title) || '';
    bodyEl.textContent = (data && data.body) || '';

    if (data && data.image) {
      imgEl.src = data.image;
      imgEl.style.display = 'block';
    } else {
      imgEl.removeAttribute('src');
      imgEl.style.display = 'none';
    }

    lastFocused = document.activeElement;
    m.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    m.querySelector('.popup-modal__close').focus();
  }

  // 将来のAPI接続処理から呼び出せるよう公開する。今回はどこからも自動的に
  // 呼び出さない(手動 `CSPJPopup.open({...})` でのみ開ける状態)。
  window.CSPJPopup = { open: openPopup, close: closePopup };
})();
