/* Cookie choice + Google Tag Manager (Google Consent Mode, "advanced").
   GTM loads on every page so Google can detect it, but storage is denied by default: no analytics or advertising
   cookies are set until the visitor clicks Accept. No thanks (or no choice) keeps everything denied.
   The choice is kept in this browser only (localStorage key ds_consent). Container ID below. */
(function () {
  'use strict';
  var GTM = 'GTM-THVNZZQL', KEY = 'ds_consent', loaded = false;
  var w = window; w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  // Everything denied until the visitor accepts (Google Consent Mode v2).
  gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', wait_for_update: 500 });
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* choice just won't be remembered */ } }
  function loadGtm() {
    if (loaded) return; loaded = true;
    w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM;
    document.head.appendChild(s);
  }
  function setConsent(on) {
    var v = on ? 'granted' : 'denied';
    gtag('consent', 'update', { ad_storage: v, analytics_storage: v, ad_user_data: v, ad_personalization: v });
  }
  function closeBar() { var b = document.getElementById('ds-consent'); if (b) b.remove(); }
  function show() {
    closeBar();
    var b = document.createElement('div'); b.id = 'ds-consent'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Cookie choice');
    b.innerHTML = '<style>#ds-consent{position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:560px;margin:0 auto;background:#1a1614;color:#f6efe7;border:1px solid #c84f00;border-radius:14px;padding:16px;font:15px/1.4 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.45)}#ds-consent p{margin:0 0 12px}#ds-consent a{color:#ff8a33}#ds-consent .r{display:flex;gap:10px;flex-wrap:wrap}#ds-consent button{flex:1;min-width:120px;font:inherit;font-weight:700;border-radius:999px;padding:11px 16px;cursor:pointer;border:2px solid #c84f00}#ds-consent .y{background:#c84f00;color:#fff}#ds-consent .n{background:transparent;color:#f6efe7}</style>' +
      '<p><b>Cookies?</b> With your OK we use Google tools to count visits and measure our ads. Say no and no cookies are set, and you can still order. <a href="/privacy.html#cookies">More</a></p>' +
      '<div class="r"><button type="button" class="n" id="ds-no">No thanks</button><button type="button" class="y" id="ds-yes">Accept</button></div>';
    document.body.appendChild(b);
    document.getElementById('ds-yes').onclick = function () { set('yes'); closeBar(); setConsent(true); };
    document.getElementById('ds-no').onclick = function () { set('no'); closeBar(); setConsent(false); };
  }
  w.dsCookieSettings = function () { try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ } show(); };
  function footerLinks() {
    var links = document.querySelectorAll('footer a[href="/privacy.html"], footer a[href="privacy.html"]');
    links.forEach(function (a) {
      if (a.parentNode.querySelector('.ds-cs')) return;
      var c = document.createElement('a'); c.href = '#'; c.className = 'ds-cs'; c.textContent = 'Cookie settings';
      c.addEventListener('click', function (e) { e.preventDefault(); w.dsCookieSettings(); });
      a.insertAdjacentElement('afterend', c);
    });
  }
  function init() { footerLinks(); loadGtm(); var v = get(); if (v === 'yes') setConsent(true); else if (v !== 'no') show(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
