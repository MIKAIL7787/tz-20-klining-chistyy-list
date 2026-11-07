(function () {
  'use strict';

  var APPS_SCRIPT_URL = 'PASTE_APPS_SCRIPT_URL_HERE'; // <- заменишь после деплоя Apps Script

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function getUTM() {
    var stored = sessionStorage.getItem('utm_data');
    var utm = stored ? JSON.parse(stored) : {};
    var params = new URLSearchParams(window.location.search);
    ['utm_source','utm_medium','utm_campaign','utm_content'].forEach(function (k) {
      if (params.get(k)) utm[k] = params.get(k);
    });
    utm.utm_source = utm.utm_source || 'direct';
    utm.utm_medium = utm.utm_medium || 'none';
    utm.utm_campaign = utm.utm_campaign || 'not_set';
    utm.utm_content = utm.utm_content || 'not_set';
    sessionStorage.setItem('utm_data', JSON.stringify(utm));
    return utm;
  }

  function showError(row, text) {
    row.classList.add('has-error');
    var err = row.querySelector('.field-error');
    if (err) err.textContent = text;
  }

  function clearErrors(form) {
    form.querySelectorAll('.has-error').forEach(function (r) { r.classList.remove('has-error'); });
  }

  function validate(form) {
    var errors = [];
    var name = form.name.value.trim();
    var phone = form.phone.value.trim();
    var email = form.email.value.trim();
    var area = Number(form.area_m2.value);
    var date = form.cleaning_date.value;
    var agree = form.agree.checked;

    if (name.length < 2 || name.length > 60) {
      showError(form.name.closest('.form-row'), 'Введите имя от 2 до 60 символов');
      errors.push('name');
    }
    if (!/^\+7\d{10}$/.test(phone.replace(/\s/g, ''))) {
      showError(form.phone.closest('.form-row'), 'Телефон в формате +7XXXXXXXXXX');
      errors.push('phone');
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      showError(form.email.closest('.form-row'), 'Проверьте e-mail');
      errors.push('email');
    }
    if (!(area >= 15 && area <= 300)) {
      showError(form.area_m2.closest('.form-row'), 'Площадь от 15 до 300 м²');
      errors.push('area_m2');
    }
    if (!date) {
      showError(form.cleaning_date.closest('.form-row'), 'Выберите дату');
      errors.push('cleaning_date');
    }
    if (!agree) {
      showError(form.agree.closest('.form-row'), 'Без согласия форма не отправляется');
      errors.push('agree');
    }
    return errors;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('order-form');
    if (!form) return;

    var utm = getUTM();
    form.request_id.value = 'REQ-' + uuid();
    form.utm_source.value = utm.utm_source;
    form.utm_medium.value = utm.utm_medium;
    form.utm_campaign.value = utm.utm_campaign;
    form.utm_content.value = utm.utm_content;

    // дата: ближайшие 14 дней с завтрашнего
    var dateInput = form.cleaning_date;
    var today = new Date();
    var min = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    var max = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);
    function fmt(d) {
      var m = ('0' + (d.getMonth() + 1)).slice(-2);
      var day = ('0' + d.getDate()).slice(-2);
      return d.getFullYear() + '-' + m + '-' + day;
    }
    dateInput.min = fmt(min);
    dateInput.max = fmt(max);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(form);
      var errors = validate(form);
      if (errors.length) {
        errors.forEach(function (field) { window.trackFormError(field, 'validation'); });
        return;
      }
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Отправляем...';

      var data = {
        request_id: form.request_id.value,
        name: form.name.value.trim(),
        phone: form.phone.value.trim(),
        email: form.email.value.trim(),
        cleaning_type: form.cleaning_type.value,
        area_m2: Number(form.area_m2.value),
        cleaning_date: form.cleaning_date.value + 'T' + form.cleaning_time.value,
        utm_source: form.utm_source.value,
        utm_medium: form.utm_medium.value,
        utm_campaign: form.utm_campaign.value,
        utm_content: form.utm_content.value
      };

      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.ok) {
            // 7. generate_lead — только после ok: true
            window.gtag('event', 'generate_lead', {
              lead_cleaning_type: data.cleaning_type,
              area_m2: data.area_m2,
              value: res.total || 0,
              currency: 'RUB'
            });
            sessionStorage.setItem('last_lead', JSON.stringify({
              request_id: data.request_id,
              date: data.cleaning_date,
              total: res.total || 0
            }));
            window.location.href = 'thanks.html';
          } else {
            window.trackFormError(res.error_field || 'form', 'server');
            btn.disabled = false;
            btn.textContent = 'Заказать уборку';
            alert('Ошибка: ' + (res.error || 'попробуйте ещё раз'));
          }
        })
        .catch(function () {
          window.trackFormError('form', 'server');
          btn.disabled = false;
          btn.textContent = 'Заказать уборку';
          alert('Сервер недоступен. Попробуйте позже.');
        });
    });
  });
})();
