/* Rastreamento Meta (Facebook) — carregado em todas as paginas do funil.
   Em paises que exigem consentimento previo (Europa / Reino Unido) o pixel
   simplesmente nao carrega, conforme escolha do dono do site. */
(function () {
  var PIXEL_ID = '1078452948251354';

  function isConsentRegion() {
    try {
      var tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '') + '';
      if (!tz) return true; // regiao desconhecida: nao rastreia
      if (tz.indexOf('Europe/') === 0) return true;
      if (tz === 'GB' || tz === 'GB-Eire' || tz === 'Eire' || tz === 'Portugal' || tz === 'Poland') return true;
      if (tz === 'Atlantic/Canary' || tz === 'Atlantic/Madeira' || tz === 'Atlantic/Azores' || tz === 'Atlantic/Faroe' || tz === 'Atlantic/Reykjavik') return true;
      if (tz === 'Africa/Ceuta') return true;
      return false;
    } catch (e) {
      return true;
    }
  }

  function addPrivacyLink() {
    try {
      if (document.getElementById('lk-privacy-link')) return;
      var a = document.createElement('a');
      a.id = 'lk-privacy-link';
      a.href = '/privacidade/';
      a.textContent = 'Politica de Privacidade';
      a.style.cssText =
        'display:block;text-align:center;font-size:11px;opacity:.55;color:inherit;padding:14px 8px;text-decoration:underline;font-family:inherit';
      document.body.appendChild(a);
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addPrivacyLink);
  } else {
    addPrivacyLink();
  }

  if (isConsentRegion()) return;

  /* base code oficial do Meta */
  !(function (f, b, e, v, n, t, s) {
    if (f.fbq) return;
    n = f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = !0;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = !0;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');

  function num(v) {
    if (v == null) return 0;
    var n = parseFloat(String(v).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
    return isFinite(n) ? n : 0;
  }

  var path = location.pathname.replace(/\/+$/, '') || '/';
  var preco = 0;
  try {
    preco = num(sessionStorage.getItem('preco'));
  } catch (e) {}

  if (path === '/loja') {
    fbq('track', 'ViewContent', { content_name: 'Loja', currency: 'BRL' });
  } else if (path === '/' || path === '/index.html') {
    fbq('track', 'InitiateCheckout', { currency: 'BRL', value: preco || 14.9 });
  } else if (path === '/ebookdesign') {
    fbq('track', 'AddPaymentInfo', { currency: 'BRL', value: preco || 14.9 });
  } else if (path === '/rec/up1') {
    fbq('track', 'AddPaymentInfo', { currency: 'BRL', value: 14.84, content_name: 'Upsell 1' });
  } else if (path === '/rec/up2') {
    fbq('track', 'AddPaymentInfo', { currency: 'BRL', value: 19.9, content_name: 'Upsell 2' });
  } else if (path === '/rec/up3') {
    fbq('track', 'AddPaymentInfo', { currency: 'BRL', value: 29.9, content_name: 'Upsell 3' });
  }
})();

// Clientes em tempo real no painel
(function () {
  try {
    var p = location.pathname.replace(/\/+$/, '') || '/';
    var map = { '/recarga': 'recarga', '/quizre': 'quiz', '/roleta': 'roleta', '/loja': 'loja', '/': 'checkout', '/ebookdesign': 'pix', '/rec/up1': 'up1', '/rec/up2': 'up2', '/rec/up3': 'up3' };
    var step = map[p]; if (!step) return;
    var sid = localStorage.getItem('rj_sid');
    if (!sid) { sid = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); localStorage.setItem('rj_sid', sid); }
    var c = new URLSearchParams(location.search).get('utm_campaign') || localStorage.getItem('rj_camp') || '';
    if (c) localStorage.setItem('rj_camp', c);
    var url = 'https://ignite-joy-quiz.lovable.app/api/public/presence';
    var ping = function () {
      if (document.visibilityState === 'hidden') return;
      var b = JSON.stringify({ sid: sid, step: step, c: c });
      if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([b], { type: 'text/plain' }));
      else fetch(url, { method: 'POST', body: b, keepalive: true });
    };
    ping(); setInterval(ping, 20000);
    document.addEventListener('visibilitychange', ping);
  } catch (e) {}
})();
