/**
 * DJ SAMPLE — /dj/sample/script.js
 * 完全に独立したスクリプトです。CSPJ本体の js/main.js とは無関係に動作します。
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
   使い、CSVから出演予定を取得して描画する。取得できない場合は
   index.html に書かれた静的HTML(プレースホルダー)をそのまま残す。

   本番のDJページでは、CONFIG.csvUrl を Google Sheets のCSVエクスポート
   URLに差し替えるだけで動く(例: CSPJSchedule.buildSheetCsvUrl('<シートID>', '<gid>'))。
   このサンプルでは、外部サービスなしで誰でも動作確認できるよう、
   同じディレクトリ内の events.sample.csv をダミーの取得先にしている。
   ============================================================ */
(function initSchedule() {
  const list = document.querySelector('.schedule__list');
  if (!list || !window.CSPJSchedule) return;

  const CONFIG = {
    csvUrl: 'events.sample.csv',
    djId: 'sample',
  };

  CSPJSchedule.fetchEvents(CONFIG)
    .then((events) => {
      if (!events.length) return; // 0件なら静的プレースホルダーを維持

      list.innerHTML = '';
      events.forEach((ev) => list.appendChild(renderScheduleItem(ev)));

      console.log(
        `%c[Schedule] ${events.length}件をシートから読み込みました`,
        'color:#c6ff3d;font-weight:bold;'
      );
    })
    .catch((err) => {
      console.warn('[Schedule] 読み込み失敗 → 静的HTMLのプレースホルダーを維持:', err.message);
    });

  function renderScheduleItem(ev) {
    const { escapeHtml, formatDateParts } = CSPJSchedule;
    const d = formatDateParts(ev.date);
    const dateLabel = d ? `${d.year}.${d.month}.${d.day}` : ev.date;
    const venueLabel = ev.event_name
      ? `${ev.event_name} — ${ev.venue}`
      : ev.venue;

    const li = document.createElement('li');
    li.className = 'schedule__item';
    li.innerHTML = `
      <span class="schedule__date">${escapeHtml(dateLabel)}</span>
      <span class="schedule__venue">${escapeHtml(venueLabel)}${ev.location ? ` / ${escapeHtml(ev.location)}` : ''}</span>
      <span class="schedule__tag">${escapeHtml((ev.type || 'EVENT').toUpperCase())}</span>
    `;

    // flyer_urlがある行だけ「FLYERを見る」ボタンを追加する。
    // ボタンの見た目・モーダルはこのDJページ独自の実装で、共通層(schedule-data.js)は
    // 「Drive URLを解決して読み込める画像URLを返す」ところまでしか担当しない。
    if (ev.flyer_url) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'schedule__flyer-btn';
      btn.textContent = 'FLYERを見る';
      btn.addEventListener('click', () => openFlyerModal(ev.flyer_url));
      li.appendChild(btn);
    }

    return li;
  }
})();

/* ============================================================
   Flyer Modal — 「FLYERを見る」ボタンから開くモーダル。
   このDJページ独自のHTML/CSS/挙動。画像URLの解決（Google Drive変換含む）は
   共通層の CSPJSchedule.loadFlyerImage() に完全に委譲し、ここでは
   「表示する／失敗したら外部リンクを出す」という見せ方だけを担当する。
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

    // リセット
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
