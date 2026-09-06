/**
 * Connect Spread PJ — /contact/script.js
 * 完全に独立したスクリプトです。CSPJ本体・DJポータル・各DJページ・/portal/の
 * JSとは無関係に動作します。
 *
 * 役割:
 *   1. 控えめなscroll reveal
 *   2. お問い合わせフォームのクライアント側バリデーション・
 *      成功/失敗表示の切り替え・二重送信防止
 *   3. Cloudflare Turnstile(ボット検証)の結果取得
 *   4. POST https://api.cs-pj.com/v1/contact への本番送信
 *
 * 送信フロー(2026-09-06接続):
 *   Turnstileウィジェットが検証を完了するとwindow.onTurnstileSuccess()が
 *   呼ばれ、取得したトークンをturnstileTokenに保持する。フォーム送信時、
 *   クライアント側バリデーション + Turnstileトークンの存在確認の両方を
 *   通過した場合のみ、実際のAPIへfetch()する。
 *
 *   レスポンスが201 Createdの場合のみ成功UIを表示する。それ以外の
 *   ステータス・通信エラーはすべて同じ汎用エラーメッセージを表示し、
 *   ステータスコードやエラー内容など内部情報はユーザーへ一切表示しない。
 *
 *   Turnstileのトークンは一度検証に使うと再利用できない(ワンタイム)ため、
 *   成功・失敗を問わず送信試行のたびにturnstile.reset()でウィジェットを
 *   リセットし、次回送信時は必ず新しいトークンを要求する。
 *
 *   クライアント側バリデーションはあくまでUXのためのものであり、
 *   セキュリティ境界はAPI側(Turnstile検証・サーバー側バリデーション)に
 *   ある。ここでのチェックを迂回されても、API側で弾かれる想定。
 *
 *   Secret Keyはこのファイル・このリポジトリのどこにも含まれていない
 *   (api.CSPJ_HP側のCloudflare Worker Secretとしてのみ管理される)。
 */
'use strict';

// Cloudflare Turnstileの検証結果トークン。ウィジェットのcallbackから設定される。
// data-callback等のHTML属性からグローバル関数として参照されるため、
// IIFEの外(モジュールトップレベル)で保持する。
var turnstileToken = '';

// data-callback="onTurnstileSuccess" 等はTurnstileが window.onTurnstileSuccess
// をグローバル関数として呼び出す仕様のため、windowに明示的に生やす。
window.onTurnstileSuccess = function (token) {
  turnstileToken = token || '';
  var errorEl = document.getElementById('error-turnstile');
  var widget = document.getElementById('contactTurnstile');
  var row = widget ? widget.closest('.contact-form__row') : null;
  if (errorEl) errorEl.textContent = '';
  if (row) row.classList.remove('contact-form__row--invalid');
};

window.onTurnstileExpired = function () {
  turnstileToken = '';
};

window.onTurnstileError = function () {
  turnstileToken = '';
};

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

(function initContactForm() {
  var form = document.getElementById('contactForm');
  if (!form) return;

  var submitBtn = document.getElementById('contactSubmit');
  var successBox = document.getElementById('contactSuccess');
  var errorBanner = document.getElementById('contactErrorBanner');
  var isSubmitting = false;

  var CONTACT_API_URL = 'https://api.cs-pj.com/v1/contact';

  // /privacy/ の現在のバージョン(privacy/index.html の <dl class="privacy-hero__dates">
  // と同じ値)。/privacy/ を改定してバージョンを上げた場合は、ここも同じ値に
  // 合わせて更新すること。
  var PRIVACY_POLICY_VERSION = '2026-09-05';

  // フォーム側の表示用value → API側が受け付けるcategory値へのマッピング。
  // 表示用のvalue(html側)は変更せず、送信直前にAPI仕様へ変換する。
  var CATEGORY_MAP = {
    web: 'web_site',
    dj: 'dj_site',
    visual: 'visual_flyer',
    promotion: 'promotion',
    event: 'event',
    other: 'other'
  };

  // お問い合わせ内容の文字数範囲。api.CSPJ_HP側 src/lib/contact-validate.js の
  // MESSAGE_MIN / MESSAGE_MAX(trim後10〜5000文字)と同じ値。ここが一致していないと、
  // クライアント側は通過してもAPI側で400 Bad Requestになる(2026-09-06に実際に発生・
  // 特定した不一致)。API側の値を変更した場合はここも合わせて更新すること。
  var MESSAGE_MIN_LENGTH = 10;
  var MESSAGE_MAX_LENGTH = 5000;

  // フィールドID → { required, validate(value) }。validateはtrueで合格。
  var fields = {
    name: {
      el: document.getElementById('name'),
      required: true,
      message: 'お名前を入力してください。',
    },
    email: {
      el: document.getElementById('email'),
      required: true,
      message: 'メールアドレスを入力してください。',
      validate: function (value) {
        // 簡易チェック(type="email"のネイティブ検証も併用する)
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      },
      invalidMessage: 'メールアドレスの形式が正しくありません。',
    },
    'inquiry-type': {
      el: document.getElementById('inquiry-type'),
      required: true,
      message: 'お問い合わせ種別を選択してください。',
    },
    message: {
      el: document.getElementById('message'),
      required: true,
      message: 'お問い合わせ内容を入力してください。',
    },
    privacy: {
      el: document.getElementById('privacy'),
      required: true,
      isCheckbox: true,
      message: 'プライバシーポリシーへの同意が必要です。',
    },
  };

  // 送信必須ではない(SNS / Web URL)が、入力された場合のみ簡易チェックする
  var optionalUrlField = document.getElementById('sns-url');

  function showError(key, message) {
    var field = fields[key];
    var errorEl = document.getElementById('error-' + key);
    var row = field.el.closest('.contact-form__row');
    if (errorEl) errorEl.textContent = message || '';
    if (row) row.classList.toggle('contact-form__row--invalid', !!message);
    field.el.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  function clearError(key) {
    showError(key, '');
  }

  // 入力し直したタイミングでそのフィールドのエラーだけ消す(UX向上)
  Object.keys(fields).forEach(function (key) {
    var field = fields[key];
    var eventName = field.isCheckbox ? 'change' : 'input';
    field.el.addEventListener(eventName, function () { clearError(key); });
  });
  if (optionalUrlField) {
    optionalUrlField.addEventListener('input', function () {
      var errorEl = document.getElementById('error-sns-url');
      if (errorEl) errorEl.textContent = '';
      optionalUrlField.closest('.contact-form__row').classList.remove('contact-form__row--invalid');
    });
  }

  function validate() {
    var isValid = true;

    Object.keys(fields).forEach(function (key) {
      var field = fields[key];
      var value = field.isCheckbox ? field.el.checked : field.el.value.trim();

      if (field.required && (field.isCheckbox ? !value : value === '')) {
        showError(key, field.message);
        isValid = false;
        return;
      }

      if (field.validate && value && !field.validate(value)) {
        showError(key, field.invalidMessage || field.message);
        isValid = false;
        return;
      }

      clearError(key);
    });

    // お問い合わせ内容の文字数範囲チェック(API側と同じtrim後10〜5000文字)。
    // 空文字の場合は上のforEachの必須チェックで既に処理済みのため、ここでは
    // 「非空だが範囲外」の場合のみ扱う(必須エラーの文言を上書きしないため)。
    var messageValue = fields.message.el.value.trim();
    if (messageValue.length > 0) {
      if (messageValue.length < MESSAGE_MIN_LENGTH) {
        showError('message', 'お問い合わせ内容は10文字以上で入力してください。');
        isValid = false;
      } else if (messageValue.length > MESSAGE_MAX_LENGTH) {
        showError('message', 'お問い合わせ内容は5000文字以内で入力してください。');
        isValid = false;
      }
    }

    // SNS / Web URL(任意) — 入力があった場合のみ簡易URL形式チェック
    if (optionalUrlField) {
      var urlValue = optionalUrlField.value.trim();
      var urlErrorEl = document.getElementById('error-sns-url');
      var urlRow = optionalUrlField.closest('.contact-form__row');
      if (urlValue && !/^https?:\/\/.+/i.test(urlValue)) {
        if (urlErrorEl) urlErrorEl.textContent = 'URLは http:// または https:// から入力してください。';
        if (urlRow) urlRow.classList.add('contact-form__row--invalid');
        isValid = false;
      } else {
        if (urlErrorEl) urlErrorEl.textContent = '';
        if (urlRow) urlRow.classList.remove('contact-form__row--invalid');
      }
    }

    return isValid;
  }

  // Turnstileの検証結果を確認する。他フィールドと同じ表示スタイル
  // (.contact-form__error / .contact-form__row--invalid)を再利用する。
  function validateTurnstile() {
    var errorEl = document.getElementById('error-turnstile');
    var widget = document.getElementById('contactTurnstile');
    var row = widget ? widget.closest('.contact-form__row') : null;

    if (!turnstileToken) {
      if (errorEl) errorEl.textContent = '認証を完了してください。';
      if (row) row.classList.add('contact-form__row--invalid');
      return false;
    }

    if (errorEl) errorEl.textContent = '';
    if (row) row.classList.remove('contact-form__row--invalid');
    return true;
  }

  function getApiPayload() {
    var snsUrl = optionalUrlField ? optionalUrlField.value.trim() : '';
    var inquiryType = fields['inquiry-type'].el.value;

    return {
      name: fields.name.el.value.trim(),
      email: fields.email.el.value.trim(),
      category: CATEGORY_MAP[inquiryType] || inquiryType,
      sns_url: snsUrl || null,
      message: fields.message.el.value.trim(),
      privacy_consent: fields.privacy.el.checked,
      privacy_policy_version: PRIVACY_POLICY_VERSION,
      turnstile_token: turnstileToken,
    };
  }

  // 本番API呼び出し。201 Createdの場合のみ ok:true を返す。
  // レスポンスの内容(エラーメッセージ等)は呼び出し元(送信ハンドラ)へは
  // 渡さない — ユーザーへ内部情報を表示しないため、ここでステータスのみ判定する。
  function submitContactForm(payload) {
    return fetch(CONTACT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (response) {
      return { ok: response.status === 201 };
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (isSubmitting) return; // 二重送信防止

    if (errorBanner) errorBanner.hidden = true;

    var fieldsValid = validate();
    var turnstileValid = validateTurnstile();

    if (!fieldsValid || !turnstileValid) {
      // 最初のエラー項目にフォーカスを移す(Turnstileウィジェット自体は
      // フォーカス不可のため、フィールドの入力エラーを優先する)
      var firstInvalid = form.querySelector(
        '.contact-form__row--invalid .contact-form__input, .contact-form__row--invalid .contact-form__checkbox'
      );
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    isSubmitting = true;
    submitBtn.disabled = true;
    var originalText = submitBtn.querySelector('.contact-form__submit-text').textContent;
    submitBtn.querySelector('.contact-form__submit-text').textContent = 'Sending...';

    submitContactForm(getApiPayload())
      .then(function (result) {
        if (!result || !result.ok) throw new Error('submit failed');
        form.hidden = true;
        if (successBox) {
          successBox.hidden = false;
          successBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      })
      .catch(function () {
        // 4xx/5xx・通信エラーいずれもここに到達する。内部エラーの詳細は
        // ユーザーへ表示しない(汎用メッセージのみ)。
        if (errorBanner) {
          errorBanner.hidden = false;
          errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      })
      .finally(function () {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.querySelector('.contact-form__submit-text').textContent = originalText;

        // Turnstileのトークンはワンタイムのため、成功・失敗を問わず
        // 送信試行のたびにリセットし、次回は必ず新しいトークンを要求する。
        if (typeof turnstile !== 'undefined' && typeof turnstile.reset === 'function') {
          turnstile.reset();
        }
        turnstileToken = '';
      });
  });
})();
