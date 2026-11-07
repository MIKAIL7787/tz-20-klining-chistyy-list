(function () {
  'use strict';

  if (typeof window.gtag !== 'function') {
    // gtag.js не загружен — события не отправляем, чтобы не ломать страницу
    window.gtag = function () {};
  }

  // -------- helpers --------
  function getParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name) || '';
  }

  function getUTM() {
    var stored = sessionStorage.getItem('utm_data');
    var utm = stored ? JSON.parse(stored) : {};
    var fromUrl = {
      utm_source: getParam('utm_source'),
      utm_medium: getParam('utm_medium'),
      utm_campaign: getParam('utm_campaign'),
      utm_content: getParam('utm_content')
    };
    Object.keys(fromUrl).forEach(function (k) {
      if (fromUrl[k]) utm[k] = fromUrl[k];
    });
    utm.utm_source = utm.utm_source || 'direct';
    utm.utm_medium = utm.utm_medium || 'none';
    utm.utm_campaign = utm.utm_campaign || 'not_set';
    utm.utm_content = utm.utm_content || 'not_set';
    sessionStorage.setItem('utm_data', JSON.stringify(utm));
    return utm;
  }

  window.ChistyListUTM = getUTM();

  // -------- универсальный обработчик data-event --------
  function track(el, eventName, params) {
    window.gtag('event', eventName, params || {});
  }

  function bindDataEvents() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-event]');
      if (!el) return;
      var eventName = el.getAttribute('data-event');
      var params = {};
      // копируем все data-* в параметры snake_case
      Array.prototype.forEach.call(el.attributes, function (attr) {
        if (attr.name.indexOf('data-') === 0 && attr.name !== 'data-event') {
          var key = attr.name.slice(5).replace(/-/g, '_');
          if (key.length <= 40) params[key] = String(attr.value).slice(0, 100);
        }
      });
      track(el, eventName, params);
    });
  }

  // -------- конкретные события --------

  // 7. generate_lead — отправляется только после ok: true приёмника (см. form.js)

  // 10. cleaning_calc — расчёт в калькуляторе
  window.trackCalc = function (params) {
    track(null, 'cleaning_calc', {
      cleaning_type: params.cleaning_type,
      area_m2: params.area_m2,
      extras_count: params.extras_count,
      total_price: params.total_price
    });
  };

  // 11. extra_toggle — включение доп. услуги
  window.trackExtraToggle = function (extraName, enabled) {
    track(null, 'extra_toggle', {
      extra_name: extraName,
      enabled: enabled ? 'on' : 'off'
    });
  };

  // 12. date_select — выбор даты и времени
  window.trackDateSelect = function (date, weekday) {
    track(null, 'date_select', {
      cleaning_date: date,
      weekday: weekday
    });
  };

  // 13. subscription_select — выбор частоты подписки
  window.trackSubscriptionSelect = function (frequency) {
    track(null, 'subscription_select', { frequency: frequency });
  };

  // 14. promo_copy — копирование промокода
  window.trackPromoCopy = function (code) {
    track(null, 'promo_copy', { promo_code: code });
  };

  // 18. form_error — ошибка формы
  window.trackFormError = function (fieldName, errorType) {
    track(null, 'form_error', {
      field_name: fieldName,
      error_type: errorType
    });
  };

  // -------- биндинги после DOMContentLoaded --------
  document.addEventListener('DOMContentLoaded', function () {
    bindDataEvents();

    // 9. service_view — клик по карточке услуги
    document.querySelectorAll('[data-service]').forEach(function (card) {
      card.addEventListener('click', function () {
        track(card, 'service_view', {
          cleaning_type: card.getAttribute('data-service')
        });
      });
    });

    // 12. date_select — при выборе даты/времени в форме
    var dateInput = document.getElementById('cleaning_date');
    var timeSelect = document.getElementById('cleaning_time');
    if (dateInput) {
      dateInput.addEventListener('change', function () {
        var d = new Date(dateInput.value + 'T00:00:00');
        var weekdays = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
        window.trackDateSelect(dateInput.value, weekdays[d.getDay()] || '');
      });
    }
    if (timeSelect) {
      timeSelect.addEventListener('change', function () {
        window.trackDateSelect(dateInput ? dateInput.value : '', '');
      });
    }

    // 13. subscription_select
    document.querySelectorAll('[data-frequency]').forEach(function (el) {
      el.addEventListener('change', function () {
        if (el.checked) window.trackSubscriptionSelect(el.getAttribute('data-frequency'));
      });
    });

    // 14. promo_copy
    document.querySelectorAll('[data-promo]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var code = btn.getAttribute('data-promo');
        if (navigator.clipboard) {
          navigator.clipboard.writeText(code).then(function () {
            window.trackPromoCopy(code);
            btn.textContent = 'Скопировано ✓';
          });
        } else {
          window.trackPromoCopy(code);
        }
      });
    });

    // 15. contact_click — tel: и mailto:
    document.querySelectorAll('a[href^="tel:"]').forEach(function (a) {
      a.addEventListener('click', function () {
        track(a, 'contact_click', { contact_type: 'phone' });
      });
    });
    document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
      a.addEventListener('click', function () {
        track(a, 'contact_click', { contact_type: 'email' });
      });
    });

    // 16. messenger_click — Telegram/WhatsApp
    document.querySelectorAll('[data-messenger]').forEach(function (a) {
      a.addEventListener('click', function () {
        track(a, 'messenger_click', { messenger: a.getAttribute('data-messenger') });
      });
    });

    // 17. social_click — иконки соцсетей
    document.querySelectorAll('[data-social]').forEach(function (a) {
      a.addEventListener('click', function () {
        track(a, 'social_click', {
          network: a.getAttribute('data-social'),
          page_section: a.getAttribute('data-section') || 'footer'
        });
      });
    });

    // 19. faq_open (по выбору)
    document.querySelectorAll('[data-faq]').forEach(function (el) {
      el.addEventListener('click', function () {
        track(el, 'faq_open', { question_id: el.getAttribute('data-faq') });
      });
    });

    // 20. gallery_view (по выбору)
    document.querySelectorAll('[data-gallery]').forEach(function (el) {
      el.addEventListener('click', function () {
        track(el, 'gallery_view', { photo_index: el.getAttribute('data-gallery') });
      });
    });
  });
})();
