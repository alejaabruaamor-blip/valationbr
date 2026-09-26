/* Rastreamento do funil: Meta Pixel + UTM
   >>> Coloque aqui o ID do seu pixel do Facebook <<< */
var META_PIXEL_ID = "SEU_PIXEL_ID";

(function () {
  "use strict";

  /* ---------- Meta Pixel ---------- */
  if (!window.fbq) {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
  }
  if (META_PIXEL_ID && META_PIXEL_ID.indexOf("SEU_") !== 0) {
    fbq('init', META_PIXEL_ID);
    fbq('track', 'PageView');
  }

  /* ---------- UTM: captura, guarda e propaga ---------- */
  var KEYS = ["utm_source","utm_medium","utm_campaign","utm_content","utm_term",
              "utm_id","src","sck","fbclid","gclid","ttclid","xcod"];
  var STORE = "funil_utm";

  function read() {
    try { return JSON.parse(sessionStorage.getItem(STORE) || "{}"); } catch (e) { return {}; }
  }
  function save(o) {
    try { sessionStorage.setItem(STORE, JSON.stringify(o)); } catch (e) {}
    try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) {}
  }

  var saved = read();
  if (!Object.keys(saved).length) {
    try { saved = JSON.parse(localStorage.getItem(STORE) || "{}"); } catch (e) { saved = {}; }
  }
  var q = new URLSearchParams(window.location.search);
  var changed = false;
  KEYS.forEach(function (k) {
    var v = q.get(k);
    if (v) { saved[k] = v; changed = true; }
  });
  if (changed || Object.keys(saved).length) save(saved);

  window.funilUtm = saved;
  window.funilUtmQuery = function () {
    var p = new URLSearchParams();
    Object.keys(saved).forEach(function (k) { p.set(k, saved[k]); });
    var s = p.toString();
    return s ? s : "";
  };

  function withUtm(url) {
    var qs = window.funilUtmQuery();
    if (!qs) return url;
    try {
      var u = new URL(url, window.location.href);
      if (u.origin !== window.location.origin) return url;
      Object.keys(saved).forEach(function (k) {
        if (!u.searchParams.get(k)) u.searchParams.set(k, saved[k]);
      });
      return u.pathname + u.search + u.hash;
    } catch (e) { return url; }
  }
  window.comUtm = withUtm;

  function paintLinks() {
    var as = document.querySelectorAll('a[href]');
    for (var i = 0; i < as.length; i++) {
      var h = as[i].getAttribute('href');
      if (!h || h.charAt(0) === '#' || /^(mailto:|tel:|javascript:)/i.test(h)) continue;
      as[i].setAttribute('href', withUtm(h));
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', paintLinks);
  } else { paintLinks(); }
  setTimeout(paintLinks, 1500);

  /* redirecionamentos por JS tambem levam as UTMs */
  try {
    var _assign = window.location.assign.bind(window.location);
    window.irPara = function (url) { _assign(withUtm(url)); };
  } catch (e) {}

  /* ---------- Eventos do funil ---------- */
  var path = window.location.pathname.toLowerCase();
  function ev(name, data) { if (window.fbq) fbq('track', name, data || {}); }

  if (/checkout/.test(path)) ev('InitiateCheckout');
  else if (/up[1-5]/.test(path)) ev('AddToCart');
  else if (/obrigado/.test(path)) ev('Purchase', { currency: 'BRL' });
  else ev('ViewContent');

  window.trackPix = function (valor) {
    ev('AddPaymentInfo', { currency: 'BRL', value: Number(valor) || 0 });
  };
})();
