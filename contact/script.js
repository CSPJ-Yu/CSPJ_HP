/**
 * Connect Spread PJ — /contact/script.js
 * 完全に独立したスクリプトです。CSPJ本体・DJポータル・各DJページ・/portal/の
 * JSとは無関係に動作します。
 *
 * 現状の役割:
 *   1. 控えめなscroll reveal
 *   2. お問い合わせフォームのクライアント側バリデーション・
 *      成功/失敗表示の切り替え・二重送信防止
 *
 * 重要(送信処理について):
 *   送信先バックエンドAPI(POST /api/contact 等、Turnstile検証・D1保存・
 *   CSPJへのメール通知を想定)はまだ確定・実装されていない。存在しない
 *   endpointを推測してfetch()することはしていない。
 *
 *   そのため、バリデーションがすべて通った場合でも実際にはどこにも送信されず、
 *   index.html に書かれた正直な文言(「現在、送信システムを準備中のため
 *   まだ送信されておりません」)を表示するだけに留めている。
 *   将来バックエンドが確定したら、submitContactForm() の中身を実際の
 *   fetch('/api/contact', ...) 呼び出しに差し替えること
 *   (バリデーション・UI状態管理の呼び出し側は変更不要な設計にしてある)。
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

(function initContactForm() {
  var form = document.getElementById('contactForm');
  if (!form) return;

  var submitBtn = document.getElementById('contactSubmit');
  var successBox = document.getElementById('contactSuccess');
  var errorBanner = document.getElementById('contactErrorBanner');
  var isSubmitting = false;

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

  // 現時点でのダミー送信処理。バックエンド確定後、ここを実際の
  // fetch('/api/contact', { method:'POST', body: JSON.stringify(data) }) 等に
  // 差し替える(呼び出し側のvalidate()・UI切り替えロジックは変更不要)。
  function submitContactForm(data) {
    return new Promise(function (resolve) {
      setTimeout(function () { resolve({ ok: true }); }, 500);
    });
  }

  function getFormData() {
    return {
      name: fields.name.el.value.trim(),
      email: fields.email.el.value.trim(),
      inquiry_type: fields['inquiry-type'].el.value,
      sns_url: optionalUrlField ? optionalUrlField.value.trim() : '',
      message: fields.message.el.value.trim(),
      privacy: fields.privacy.el.checked,
    };
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (isSubmitting) return; // 二重送信防止

    if (errorBanner) errorBanner.hidden = true;

    if (!validate()) {
      // 最初のエラー項目にフォーカスを移す
      var firstInvalid = form.querySelector('.contact-form__row--invalid .contact-form__input, .contact-form__row--invalid .contact-form__checkbox');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    isSubmitting = true;
    submitBtn.disabled = true;
    var originalText = submitBtn.querySelector('.contact-form__submit-text').textContent;
    submitBtn.querySelector('.contact-form__submit-text').textContent = 'Sending...';

    submitContactForm(getFormData())
      .then(function (result) {
        if (!result || !result.ok) throw new Error('submit failed');
        form.hidden = true;
        if (successBox) {
          successBox.hidden = false;
          successBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      })
      .catch(function () {
        // 現状のダミー実装では発生しないが、将来の実API接続時のための土台。
        // 内部エラーの詳細はユーザーへ表示しない。
        if (errorBanner) {
          errorBanner.hidden = false;
          errorBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      })
      .finally(function () {
        isSubmitting = false;
        submitBtn.disabled = false;
        submitBtn.querySelector('.contact-form__submit-text').textContent = originalText;
      });
  });
})();
