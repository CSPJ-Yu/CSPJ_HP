/**
 * Connect Spread PJ — /portal/dj/script.js
 * 完全に独立したスクリプトです。/portal/script.js・CSPJ本体・旧DJポータル・
 * 各DJページのJSとは無関係に動作します(ただし /dj/shared/js/ のデータ取得層は
 * 各DJページと共通で利用する。詳細は initDjList() のコメント参照)。
 *
 * 役割:
 *   1. 控えめなscroll reveal
 *   2. DJ一覧の取得・描画・検索絞り込み(initDjList())
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

/* ============================================================
   DJ一覧 — 各DJページと共通の /dj/shared/js/ データ取得層を再利用する。

   1. dj/shared/js/dj-roster.js (CSPJDjRoster.listKnownSlugs()) から
      「存在するDJのslug一覧」を取得する(公開APIにまだ一覧endpointが無いための
      暫定措置。詳細はindex.html・dj-roster.js内のコメント参照)。
   2. 各slugについて dj/shared/js/profile-data.js (CSPJProfile.fetchProfile) 経由で
      公開API(GET /v1/djs/:slug)から display_name を取得する。
   3. 取得できたDJ(display_nameがあるもの)だけをカードとして描画する。
      個別のslugの取得失敗(非公開化等)は、そのDJだけを一覧から静かに除外する
      (Promise.allSettledのため、1件の失敗が一覧全体を止めない)。
   4. 検索入力(#djSearchInput)に応じて、取得済みのDJをクライアント側で
      大文字小文字を区別せずフィルタする(DJ名・slugの両方が対象)。

   写真・ジャンルは公開APIにデータが存在しないため、今回は表示しない
   (推測で追加していない。/dj/README.md参照)。
   ============================================================ */
(function initDjList() {
  var grid = document.querySelector('[data-dj-grid]');
  var loadingEl = document.querySelector('[data-dj-loading]');
  var emptyEl = document.querySelector('[data-dj-empty]');
  var searchInput = document.getElementById('djSearchInput');
  if (!grid || !loadingEl || !emptyEl) return;

  var allDjs = []; // 取得成功したDJのみ: [{ slug, display_name }, ...]
  var loadFailed = false;

  function showLoading() {
    loadingEl.hidden = false;
    loadingEl.textContent = 'Loading…';
    emptyEl.hidden = true;
    grid.hidden = true;
  }

  function showLoadFailed() {
    loadingEl.hidden = false;
    loadingEl.textContent = 'DJ情報を読み込めませんでした。時間をおいて再度お試しください。';
    emptyEl.hidden = true;
    grid.hidden = true;
  }

  function renderGrid(djs, query) {
    loadingEl.hidden = true;

    if (!djs.length) {
      emptyEl.hidden = false;
      grid.hidden = true;
      return;
    }

    emptyEl.hidden = true;
    grid.hidden = false;
    grid.innerHTML = '';
    djs.forEach(function (dj) { grid.appendChild(renderDjCard(dj)); });

    // 検索していない(通覧中)の場合のみ、末尾に「今後追加予定」のカードを
    // 添える(既存デザインの踏襲。検索結果中に混ざると誤解を招くため非表示にする)。
    if (!query) {
      grid.appendChild(renderComingSoonCard());
    }
  }

  function renderDjCard(dj) {
    var a = document.createElement('a');
    a.className = 'djp-card revealed';
    a.href = '/dj/' + encodeURIComponent(dj.slug) + '/';

    var photo = document.createElement('div');
    photo.className = 'djp-card__photo djp-card__photo--placeholder';
    photo.setAttribute('aria-hidden', 'true');
    a.appendChild(photo);

    var body = document.createElement('div');
    body.className = 'djp-card__body';

    var name = document.createElement('h3');
    name.className = 'djp-card__name';
    name.textContent = dj.display_name; // textContentのためエスケープ不要

    var link = document.createElement('span');
    link.className = 'djp-card__link';
    link.innerHTML = 'VIEW ARTIST <span aria-hidden="true">→</span>';

    body.appendChild(name);
    // Genre: 公開APIにデータが存在する場合のみ表示する(現状は常に無し)。
    body.appendChild(link);
    a.appendChild(body);

    return a;
  }

  function renderComingSoonCard() {
    var div = document.createElement('div');
    div.className = 'djp-card djp-card--placeholder revealed';
    div.setAttribute('aria-hidden', 'true');
    div.innerHTML = `
      <div class="djp-card__photo"></div>
      <div class="djp-card__body">
        <h3 class="djp-card__name">Next Artist</h3>
        <span class="djp-card__genre">Coming Soon</span>
        <p class="djp-card__desc">今後、こちらに新しいDJサイトが追加されていきます。</p>
      </div>
    `;
    return div;
  }

  function applyFilter() {
    var query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    if (!query) {
      renderGrid(allDjs, '');
      return;
    }
    var filtered = allDjs.filter(function (dj) {
      var name = String(dj.display_name || '').toLowerCase();
      var slug = String(dj.slug || '').toLowerCase();
      return name.indexOf(query) !== -1 || slug.indexOf(query) !== -1;
    });
    renderGrid(filtered, query);
  }

  if (!window.CSPJDjRoster || !window.CSPJProfile) {
    showLoadFailed();
    return;
  }

  showLoading();

  var slugs = CSPJDjRoster.listKnownSlugs();
  if (!slugs.length) {
    // ロスターが空(=既知のDJが1件も登録されていない)。API障害とは区別し、
    // 通常の0件状態として扱う。
    renderGrid([], '');
  } else {
    Promise.allSettled(
      slugs.map(function (slug) {
        // fetchProfile自体は基本的にrejectしない設計(取得失敗時はnullを解決する)
        // だが、想定外の例外(スクリプトエラー等)に備えてcatchでrejectedに倒す。
        return CSPJProfile.fetchProfile(slug)
          .then(function (profile) {
            if (!profile || !profile.display_name) return null;
            return { slug: profile.slug || slug, display_name: profile.display_name };
          })
          .catch(function (err) {
            console.warn('[DJ Portal] ' + slug + ' の読み込みに失敗:', err.message);
            throw err; // allSettledで'rejected'として区別するためそのまま再送出
          });
      })
    ).then(function (results) {
      allDjs = results
        .filter(function (r) { return r.status === 'fulfilled' && r.value; })
        .map(function (r) { return r.value; });

      // 全件が'rejected'(=ネットワークエラー等で1件も取得を試みられなかった)
      // 場合のみ、0件を「該当なし」ではなく「読み込み失敗」として区別する。
      // 一部でもfulfilled(nullを含む正常なAPI応答)があれば通常の0件表示にする。
      var allRejected = results.length > 0 && results.every(function (r) { return r.status === 'rejected'; });
      if (allRejected) {
        showLoadFailed();
        return;
      }

      renderGrid(allDjs, '');

      console.log(
        `%c[DJ Portal] ${allDjs.length}件のDJを公開APIから読み込みました`,
        'color:#00ddfa; font-weight:bold;'
      );
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', applyFilter);
  }
})();
