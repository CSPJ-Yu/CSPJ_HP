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
   Profile — CSPJ共通データ取得モジュール(/dj/shared/js/profile-data.js)を
   本番の公開API接続で使用する。

   CSPJProfile.fetchProfile('yu-x') は内部で GET https://api.cs-pj.com/v1/djs/yu-x
   を呼び出す(/dj/shared/js/api-client.js 経由)。API側が display_name しか
   返さないため、ここで動的化するのも display_name のみ(Bio/Genre/location/
   画像はAPI側にデータが存在しないため、静的HTMLのプレースホルダーをそのまま残す)。

   [data-dj-name] を付与した全要素(ヘッダーロゴ・Heroタイトル・フッター)の
   textContentを一括で置き換える。取得できない場合(ネットワークエラー・
   DJ非公開等)は、index.htmlに書かれた静的な「YU-X」表記をそのまま残す。
   ============================================================ */
(function initProfile() {
  if (!window.CSPJProfile) return;
  const targets = document.querySelectorAll('[data-dj-name]');
  if (!targets.length) return;

  CSPJProfile.fetchProfile('yu-x')
    .then((profile) => {
      if (!profile || !profile.display_name) return; // 取得失敗時は静的表記を維持
      targets.forEach((el) => { el.textContent = profile.display_name; });
    })
    .catch((err) => {
      console.warn('[Profile] 読み込み失敗 → 静的HTMLの表記を維持:', err.message);
    });
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
      // event_nameをalt文言の材料として渡す(API画像にaltデータが無いため、
      // 文脈から安全な短い代替テキストをここで組み立てる)。
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
    // APIのevent_nameからaltを組み立てる(API画像自体にaltデータは無いため)。
    // event_nameが無い行でも、既存の汎用文言「フライヤー」にフォールバックする。
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
   本番の公開API接続(GET https://api.cs-pj.com/v1/djs/yu-x/news)で使用する。

   CSPJNews.fetchNews('yu-x') は内部でAPI経由の取得・正規化・公開日降順の
   ソートまでを行う(公開/非公開の判定はAPI側の責務)。取得できない場合
   (ネットワークエラー・DJ非公開等)や0件の場合は、index.htmlに書かれた
   静的HTML(Coming Soonプレースホルダー)をそのまま残す。
   ============================================================ */
(function initNews() {
  const list = document.querySelector('[data-news-list]');
  if (!list || !window.CSPJNews) return;

  CSPJNews.fetchNews('yu-x')
    .then((items) => {
      if (!items.length) return; // 0件なら静的プレースホルダー(Coming Soon)を維持

      list.innerHTML = '';
      items.forEach((item) => list.appendChild(renderNewsItem(item)));

      console.log(
        `%c[News] ${items.length}件を公開APIから読み込みました`,
        'color:#c6ff3d; font-weight:bold;'
      );
    })
    .catch((err) => {
      console.warn('[News] 読み込み失敗 → 静的HTMLのプレースホルダーを維持:', err.message);
    });

  // 画像の有無に関わらずレイアウトが成立するよう、テキスト(日付/タイトル/本文)を
  // 常に1つのラッパーへまとめる。画像がある場合のみ .news__item--with-image を
  // 付与し、.news__image を追加の1グリッドセルとして先頭に挿入する(CSS参照)。
  // タイトル・本文は管理画面から入力される外部データのため、innerHTMLへ差し込む
  // 前に必ず CSPJUtils.escapeHtml() を通す(XSS対策)。
  function renderNewsItem(item) {
    const { escapeHtml } = CSPJUtils;
    const hasImage = !!item.image_url;

    const article = document.createElement('article');
    article.className = 'news__item' + (hasImage ? ' news__item--with-image' : '');

    if (hasImage) {
      const imageWrap = document.createElement('div');
      imageWrap.className = 'news__image';
      // APIレスポンスに画像用のalt項目は無いため、記事タイトルから安全な
      // 代替テキストを組み立てる(空alt="" にはしない — 2026-09対応)。
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

  // publish_date は "YYYY-MM-DD HH:MM:SS" 形式(時刻付き)で返ってくるため、
  // CSPJUtils.formatDateParts(日付のみを想定)に渡す前に日付部分だけを取り出す。
  function formatNewsDate(rawDate) {
    const dateOnly = String(rawDate || '').split(' ')[0];
    const parts = CSPJUtils.formatDateParts(dateOnly);
    return parts ? `${parts.year}.${parts.month}.${parts.day}` : dateOnly;
  }
})();

/* ============================================================
   SNS LINKS — CSPJ共通データ取得モジュール(/dj/shared/js/social-data.js)を
   本番の公開API接続(GET https://api.cs-pj.com/v1/djs/yu-x/social-links)で使用する。

   CSPJSocialData.fetchSocialLinks('yu-x') は登録されているSNSリンクをすべて
   返す(「表示ON/OFF」の真偽値はDBに存在せず、行の存在自体が表示対象を意味する
   設計のため、ここでの追加フィルタは行わない)。

   標準SNS(other以外)はAPIがlabelを返さない(常にnull)ため、表示名は
   このページ側の定数(SERVICE_LABELS)で決定する。これはDJ固有のコンテンツ
   データではなく、UI上のプラットフォーム表示名という純粋な見た目の情報のため、
   「コンテンツをハードコードしない」方針には反しない。

   取得できない場合(ネットワークエラー・DJ非公開等)や0件の場合は、
   index.htmlに書かれた静的HTML(Coming Soonプレースホルダー)をそのまま残す。
   ============================================================ */
(function initSocialLinks() {
  const container = document.querySelector('[data-social-list]');
  if (!container || !window.CSPJSocialData) return;

  // API側の実際のservice値(cspj-manage側DBのCHECK制約と一致)のみに対応する。
  // ここに無い値が万一返ってきた場合は、service文字列自体をそのまま表示名として使う
  // (未知の値でも安全に描画は継続する。架空のプラットフォーム名は追加しない)。
  const SERVICE_LABELS = {
    instagram: 'Instagram',
    x: 'X',
    tiktok: 'TikTok',
    youtube: 'YouTube',
    facebook: 'Facebook',
    threads: 'Threads',
  };

  CSPJSocialData.fetchSocialLinks('yu-x')
    .then((links) => {
      if (!links.length) return; // 0件なら静的プレースホルダー(Coming Soon)を維持

      const list = document.createElement('div');
      list.className = 'social__index';
      links.forEach((link) => list.appendChild(renderSocialItem(link)));

      container.innerHTML = '';
      container.appendChild(list);

      console.log(
        `%c[Social] ${links.length}件を公開APIから読み込みました`,
        'color:#f4c6ff; font-weight:bold;'
      );
    })
    .catch((err) => {
      console.warn('[Social] 読み込み失敗 → 静的HTMLのプレースホルダーを維持:', err.message);
    });

  function renderSocialItem(link) {
    const { escapeHtml } = CSPJUtils;
    // service='other' の場合のみAPIがlabelを返す(標準SNSは常にnull)。
    const displayLabel = link.label || SERVICE_LABELS[link.service] || link.service;

    const a = document.createElement('a');
    a.className = 'social__index-item';
    a.href = link.url; // fetchSocialLinks()側でhttp/https以外・空文字は既に除外済み
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.innerHTML = `${escapeHtml(displayLabel)}<span class="social__index-arrow" aria-hidden="true">↗</span>`;

    return a;
  }
})();

/* ============================================================
   Popup — モーダルのDOM生成・ARIA・開閉処理(window.CSPJPopup)。
   Flyer Modalとは DOM・クラス名・実装を完全に分離している(用途が異なるため)。
   実際にAPIから取得したデータで開くかどうかの判断は、下の initPopupApi() が
   window.CSPJPopup.open() を呼び出す形で行う(責務分離)。

   表示条件・頻度制御(Cookie等による「1日1回だけ表示」等)は今回のスコープ外。
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
      // APIレスポンスに画像用のalt項目は無いため、POPUPのタイトルから
      // 安全な代替テキストを組み立てる(textContent同様エスケープ不要)。
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

  // 他モジュールから呼び出せるよう公開する。
  window.CSPJPopup = { open: openPopup, close: closePopup };
})();

/* ============================================================
   POPUP — 公開API接続(GET https://api.cs-pj.com/v1/djs/yu-x/popup)。
   データ取得・正規化・期限切れ判定は /dj/shared/js/popup-data.js
   (CSPJPopupData.fetchPopup) が担当する。モーダルのDOM生成・ARIA・
   開閉処理(上のwindow.CSPJPopup)は無変更のまま利用するだけで、
   ここでは「開くかどうか」の判断と、開く場合の呼び出しのみを行う。

   ページ読み込み時に有効なPOPUPが取得できた場合のみ自動的に開く。
   POPUPが無い/取得失敗/期限切れの場合は何もしない
   (表示頻度制御(1日1回等)は今回のスコープ外)。
   ============================================================ */
(function initPopupApi() {
  if (!window.CSPJPopupData || !window.CSPJPopup) return;

  CSPJPopupData.fetchPopup('yu-x')
    .then((popup) => {
      if (!popup) return; // POPUPなし・取得失敗・期限切れ → 何もしない

      window.CSPJPopup.open({
        title: popup.title,
        body: popup.body,
        image: popup.image_url,
      });
    })
    .catch((err) => {
      // fetchPopup()は基本的にrejectしない設計だが、念のため保険として捕捉する。
      console.warn('[Popup] 読み込み失敗 → 表示しない:', err.message);
    });
})();
