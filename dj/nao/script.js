/**
 * DJ NAO — /dj/nao/script.js
 * 完全に独立したスクリプトです。CSPJ本体・DJポータル・他のDJページの
 * JSとは無関係に動作します。/dj/nao/ 配下の全ページ(TOP・NEWS・SCHEDULE・
 * PROFILE)から共通で読み込まれ、各init関数はそのページに
 * 該当する要素が存在する場合だけ動作する(存在しなければ何もしない)。
 */
'use strict';

// このDJページのslug。公開API(api.cs-pj.com)への問い合わせに使う唯一の値。
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
  const targets = document.querySelectorAll('main section, main .page-hero');
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
  }, { threshold: 0.12 });

  targets.forEach((el) => observer.observe(el));
})();

/* ============================================================
   Profile — CSPJ共通データ取得モジュール(/dj/shared/js/profile-data.js)を
   本番の公開API接続で使用する。

   CSPJProfile.fetchProfile('nao') は内部で GET https://api.cs-pj.com/v1/djs/nao
   を呼び出す(/dj/shared/js/api-client.js 経由)。API側が display_name と
   portal_card_image_url しか返さないため、ここで動的化するのもこの2項目のみ
   (Bio/Genre/locationはAPI側にデータが存在しないため、静的HTMLの
   プレースホルダーをそのまま残す)。

   [data-dj-name] を付与したテキスト要素(フッター等)のtextContentを
   一括で置き換える。[data-dj-logo] を付与した画像要素(ヘッダー/Hero
   ロゴ)は画像自体は差し替えず、alt属性と親要素のaria-labelのみを
   実際の表示名に更新する。[data-dj-photo] を付与した要素には、
   portal_card_image_url が取得できた場合のみ画像を差し込む(無ければ
   静的なプレースホルダー表示を維持する)。取得自体に失敗した場合
   (ネットワークエラー・DJ非公開等)は、index.htmlに書かれた静的な
   「NAO」表記・ロゴ画像・プレースホルダーをそのまま残す。
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
   Schedule — CSPJ共通データ取得モジュール(/dj/shared/js/schedule-data.js)を
   本番の公開API接続(APIモード)で使用する。

   CSPJSchedule.fetchEvents({ slug: 'nao' }) は内部で
   GET https://api.cs-pj.com/v1/djs/nao/events を呼び出す
   (/dj/shared/js/api-client.js 経由。公開/非公開判定はAPI側の責務)。

   コンテナに data-schedule-limit="N" が指定されている場合(TOPページの
   ティザー表示)は先頭N件のみ描画する。指定が無ければ(SCHEDULEページの
   全件表示)取得できた全件を描画する。

   取得できない場合(ネットワークエラー・DJ不存在等)や0件の場合は、
   index.html に書かれた静的HTML(準備中メッセージ)をそのまま残す。
   ============================================================ */
(function initSchedule() {
  const list = document.querySelector('.schedule__list');
  if (!list || !window.CSPJSchedule) return;

  const limitAttr = list.getAttribute('data-schedule-limit');
  const limit = limitAttr ? parseInt(limitAttr, 10) : null;

  CSPJSchedule.fetchEvents({ slug: DJ_SLUG })
    .then((events) => {
      if (!events.length) return; // 0件なら静的プレースホルダーを維持

      const shown = limit ? events.slice(0, limit) : events;

      list.innerHTML = '';
      shown.forEach((ev) => list.appendChild(renderScheduleItem(ev)));

      console.log(
        `%c[Schedule] ${shown.length}/${events.length}件を公開APIから読み込みました`,
        'color:#ff1493; font-weight:bold;'
      );
    })
    .catch((err) => {
      console.warn('[Schedule] 読み込み失敗 → 静的HTMLのプレースホルダーを維持:', err.message);
    });

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

    const flyerSrc = ev.image_url || ev.flyer_url;
    if (flyerSrc) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'schedule__flyer-btn';
      btn.textContent = 'FLYERを見る';
      btn.addEventListener('click', () => openFlyerModal(flyerSrc, ev.event_name));
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

  window.openFlyerModal = function openFlyerModal(rawUrl, eventName) {
    const m = ensureModal();
    const status = m.querySelector('.flyer-modal__status');
    const img = m.querySelector('.flyer-modal__img');
    const fallback = m.querySelector('.flyer-modal__fallback');

    img.style.display = 'none';
    img.removeAttribute('src');
    img.alt = eventName ? `${eventName}のフライヤー` : 'フライヤー';
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
   NEWS — CSPJ共通データ取得モジュール(/dj/shared/js/news-data.js)を
   本番の公開API接続(GET https://api.cs-pj.com/v1/djs/nao/news)で使用する。

   コンテナに data-news-limit="N" が指定されている場合(TOPページの
   ティザー表示)は先頭N件のみ描画する。指定が無ければ(NEWSページの
   全件表示)取得できた全件を描画する。

   取得できない場合(ネットワークエラー・DJ非公開等)や0件の場合は、
   index.htmlに書かれた静的HTML(Coming Soonプレースホルダー)をそのまま残す。
   ============================================================ */
(function initNews() {
  const list = document.querySelector('[data-news-list]');
  if (!list || !window.CSPJNews) return;

  const limitAttr = list.getAttribute('data-news-limit');
  const limit = limitAttr ? parseInt(limitAttr, 10) : null;

  CSPJNews.fetchNews(DJ_SLUG)
    .then((items) => {
      if (!items.length) return; // 0件なら静的プレースホルダー(Coming Soon)を維持

      const shown = limit ? items.slice(0, limit) : items;

      list.innerHTML = '';
      shown.forEach((item) => list.appendChild(renderNewsItem(item)));

      console.log(
        `%c[News] ${shown.length}/${items.length}件を公開APIから読み込みました`,
        'color:#ff8fc7; font-weight:bold;'
      );
    })
    .catch((err) => {
      console.warn('[News] 読み込み失敗 → 静的HTMLのプレースホルダーを維持:', err.message);
    });

  function renderNewsItem(item) {
    const { escapeHtml } = CSPJUtils;
    const hasImage = !!item.image_url;

    const article = document.createElement('article');
    article.className = 'news__item' + (hasImage ? ' news__item--with-image' : '');

    if (hasImage) {
      const imageWrap = document.createElement('div');
      imageWrap.className = 'news__image';
      const imgAlt = item.title ? `${item.title}の関連画像` : 'NEWS画像';
      imageWrap.innerHTML = `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(imgAlt)}">`;
      article.appendChild(imageWrap);
    }

    const content = document.createElement('div');
    content.className = 'news__content';
    content.innerHTML = `
      <span class="news__date">${escapeHtml(formatNewsDate(item.publish_date))}</span>
      <h3 class="news__title">${escapeHtml(item.title)}</h3>
      <p class="news__body">${escapeHtml(item.body)}</p>
    `;
    article.appendChild(content);

    return article;
  }

  function formatNewsDate(rawDate) {
    const dateOnly = String(rawDate || '').split(' ')[0];
    const parts = CSPJUtils.formatDateParts(dateOnly);
    return parts ? `${parts.year}.${parts.month}.${parts.day}` : dateOnly;
  }
})();

/* ============================================================
   SNS LINKS — CSPJ共通データ取得モジュール(/dj/shared/js/social-data.js)を
   本番の公開API接続(GET https://api.cs-pj.com/v1/djs/nao/social-links)で使用する。

   標準SNS(other以外)はAPIがlabelを返さない(常にnull)ため、表示名は
   このページ側の定数(SERVICE_LABELS)で決定する。

   取得できない場合(ネットワークエラー・DJ非公開等)や0件の場合は、
   index.htmlに書かれた静的HTML(Coming Soonプレースホルダー)をそのまま残す。
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

  // 簡易モノラインアイコン(独自制作。各ブランドの公式ロゴ画像は使用していない。
  // PROFILEページ(/dj/nao/profile/script.js)と同じセットを使い、見た目を揃えている)。
  const ICONS = {
    instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="0.6" fill="currentColor" stroke="none"/>',
    x: '<path d="M4.5 4.5L19.5 19.5M19.5 4.5L4.5 19.5"/>',
    tiktok: '<path d="M14 4v9.5a3.2 3.2 0 1 1-3.2-3.2c.3 0 .6 0 .9.1"/><path d="M14 4c.3 2 1.9 3.5 4 3.7"/>',
    youtube: '<rect x="3" y="6.5" width="18" height="11" rx="3.5"/><path d="M10.5 9.5l4 2.5-4 2.5z" fill="currentColor" stroke="none"/>',
    facebook: '<circle cx="12" cy="12" r="8.5"/><path d="M13.2 20v-6.3h2l.3-2.4h-2.3V9.7c0-.7.2-1.2 1.2-1.2h1.3V6.3c-.2 0-1.1-.1-2.1-.1-2.1 0-3.5 1.3-3.5 3.6v2h-2.4v2.7h2.4V21z" fill="currentColor" stroke="none"/>',
    threads: '<path d="M8 8.5c1-.7 2.2-1 3.6-1 3 0 5 1.8 5 5.2 0 3.7-2.4 5.8-5.6 5.8-2.6 0-4.5-1.3-4.5-3.4 0-2 2-3 4.6-3 .9 0 1.8.1 2.5.4"/>',
  };

  CSPJSocialData.fetchSocialLinks(DJ_SLUG)
    .then((links) => {
      if (!links.length) return; // 0件なら静的プレースホルダー(Coming Soon)を維持

      const list = document.createElement('div');
      list.className = 'social__index';
      links.forEach((link) => list.appendChild(renderSocialItem(link)));

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

  function renderSocialItem(link) {
    const { escapeHtml } = CSPJUtils;
    const displayLabel = link.label || SERVICE_LABELS[link.service] || link.service;
    const iconPath = ICONS[link.service];
    const iconHtml = iconPath
      ? `<span class="social__index-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${iconPath}</svg></span>`
      : '';

    const a = document.createElement('a');
    a.className = 'social__index-item';
    a.href = link.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML = `${iconHtml}${escapeHtml(displayLabel)}<span class="social__index-arrow" aria-hidden="true">↗</span>`;

    return a;
  }
})();

/* ============================================================
   Popup — モーダルのDOM生成・ARIA・開閉処理(window.CSPJPopup)。
   Flyer Modalとは DOM・クラス名・実装を完全に分離している。
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

  function openPopup(data) {
    const m = ensureModal();
    const titleEl = m.querySelector('.popup-modal__title');
    const bodyEl = m.querySelector('.popup-modal__body');
    const imgEl = m.querySelector('.popup-modal__img');

    titleEl.textContent = (data && data.title) || '';
    bodyEl.textContent = (data && data.body) || '';

    if (data && data.image) {
      imgEl.src = data.image;
      imgEl.alt = (data && data.title) ? `${data.title}のお知らせ画像` : 'お知らせ画像';
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

  window.CSPJPopup = { open: openPopup, close: closePopup };
})();

/* ============================================================
   POPUP — 公開API接続(GET https://api.cs-pj.com/v1/djs/nao/popup)。
   ページ読み込み時に有効なPOPUPが取得できた場合のみ自動的に開く。
   POPUPが無い/取得失敗/期限切れの場合は何もしない。
   ============================================================ */
(function initPopupApi() {
  if (!window.CSPJPopupData || !window.CSPJPopup) return;

  CSPJPopupData.fetchPopup(DJ_SLUG)
    .then((popup) => {
      if (!popup) return;

      window.CSPJPopup.open({
        title: popup.title,
        body: popup.body,
        image: popup.image_url,
      });
    })
    .catch((err) => {
      console.warn('[Popup] 読み込み失敗 → 表示しない:', err.message);
    });
})();
