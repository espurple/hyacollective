/* HYA Wellness: GA4, analytics consent and enquiry-link measurement. */
(function () {
  'use strict';
  if (window.hyaAnalyticsInstalled) return;
  window.hyaAnalyticsInstalled = true;

  var measurementId = 'G-C2YH6YKXZT';
  var consentKey = 'hya_analytics_consent_v1';
  var pendingClickKey = 'hya_pending_visit_click_v1';
  var consentLifetime = 180 * 24 * 60 * 60 * 1000;
  var configured = false;
  var currentChoice = null;
  var notice;
  var returnFocus;
  var isLiveSite = /^(www\.)?hyacollective\.com$/.test(location.hostname);
  var disabledKey = 'ga-disable-' + measurementId;
  var ownScript = document.currentScript;
  var privacyUrl = new URL('privacy.html', ownScript ? ownScript.src : location.href).href;

  window[disabledKey] = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });

  function readChoice() {
    try {
      var saved = JSON.parse(localStorage.getItem(consentKey));
      if (saved && (saved.choice === 'granted' || saved.choice === 'denied') &&
          typeof saved.time === 'number' && saved.time <= Date.now() &&
          Date.now() - saved.time < consentLifetime) return saved.choice;
    } catch (_) { /* Storage can be unavailable in private browsing. */ }
    return null;
  }

  function saveChoice(choice) {
    try {
      localStorage.setItem(consentKey, JSON.stringify({ choice: choice, time: Date.now() }));
    } catch (_) { /* The choice still applies to this page. */ }
  }

  function removeAnalyticsCookies() {
    var host = location.hostname;
    var domains = ['', host, '.' + host, 'hyacollective.com', '.hyacollective.com'];
    document.cookie.split(';').forEach(function (cookie) {
      var name = cookie.split('=')[0].trim();
      if (!/^_ga(?:_|$)/.test(name)) return;
      domains.forEach(function (domain) {
        document.cookie = name + '=; Max-Age=0; Path=/; SameSite=Lax' +
          (domain ? '; Domain=' + domain : '') + (location.protocol === 'https:' ? '; Secure' : '');
      });
    });
  }

  // Retain campaign attribution, but do not send arbitrary URL parameters.
  function measuredLocation() {
    var original = new URL(location.href);
    var clean = new URL(original.origin + original.pathname.replace(/\/index\.html$/, '/'));
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'].forEach(function (key) {
      var value = original.searchParams.get(key);
      if (value && value.length <= 100 && /^[\w .-]+$/.test(value)) clean.searchParams.set(key, value);
    });
    return clean.href;
  }

  function measuredReferrer() {
    if (!document.referrer) return '';
    try {
      var url = new URL(document.referrer);
      return url.origin + url.pathname;
    } catch (_) { return ''; }
  }

  function startAnalytics() {
    if (!isLiveSite) return; // Local previews never send visits to the live property.
    window[disabledKey] = false;
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    if (configured) return;
    configured = true;
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      send_page_view: true,
      page_location: measuredLocation(),
      page_referrer: measuredReferrer(),
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      cookie_expires: consentLifetime / 1000,
      cookie_flags: 'SameSite=Lax;Secure'
    });
    var googleTag = document.createElement('script');
    googleTag.async = true;
    googleTag.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    googleTag.id = 'hya-google-tag';
    document.head.appendChild(googleTag);
    // A normal internal link unloads its source document immediately. Complete
    // that click on the destination page, retaining the source page in the event.
    // Remove the pending record first so reloads cannot count it twice.
    try {
      var pending = JSON.parse(sessionStorage.getItem(pendingClickKey));
      sessionStorage.removeItem(pendingClickKey);
      if (pending && pending.target === location.origin + location.pathname &&
          Date.now() >= pending.time && Date.now() - pending.time < 120000) {
        window.gtag('event', 'plan_visit_click', pending.params);
      }
    } catch (_) { /* Browsers may disable session storage. */ }
  }

  function applyChoice(choice) {
    currentChoice = choice;
    if (choice === 'granted') {
      startAnalytics();
    } else {
      window[disabledKey] = true;
      window.gtag('consent', 'update', { analytics_storage: 'denied' });
      removeAnalyticsCookies();
      try { sessionStorage.removeItem(pendingClickKey); } catch (_) {}
    }
  }

  function closeNotice() {
    notice.hidden = true;
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
    returnFocus = null;
  }

  function choose(choice) {
    saveChoice(choice);
    applyChoice(choice);
    closeNotice();
  }

  function showNotice(focus) {
    if (!notice) return;
    notice.hidden = false;
    var state = document.getElementById('hya-cookie-state');
    state.textContent = currentChoice === 'granted' ? 'Analytics is currently on.' :
      currentChoice === 'denied' ? 'Analytics is currently off.' : '';
    if (focus) {
      returnFocus = document.activeElement;
      notice.focus();
    }
  }

  function installNotice() {
    var style = document.createElement('style');
    style.textContent =
      '#hya-cookie-notice{position:fixed;z-index:10000;left:20px;bottom:20px;width:min(480px,calc(100vw - 40px));max-height:calc(100dvh - 40px);overflow:auto;box-sizing:border-box;background:#FBF7EF;color:#211E18;border:1px solid #C2A982;border-radius:2px;box-shadow:0 8px 30px #211E1829;padding:20px;font:15px/1.5 var(--sans,system-ui,sans-serif)}' +
      '#hya-cookie-notice[hidden]{display:none}' +
      '#hya-cookie-notice h2{margin:0 0 8px;font:500 23px/1.2 var(--serif,Georgia,serif)}' +
      '#hya-cookie-notice p{margin:0 0 10px}' +
      '#hya-cookie-notice a{color:#2C3D34;text-decoration:underline;text-underline-offset:3px}' +
      '#hya-cookie-notice .hya-cookie-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}' +
      '#hya-cookie-notice button{flex:1 1 150px;min-height:44px;border:1px solid #2C3D34;border-radius:2px;padding:10px 12px;background:#FBF7EF;color:#2C3D34;font:inherit;cursor:pointer}' +
      '#hya-cookie-notice button:hover{background:#E5D8BF}' +
      '#hya-cookie-notice button:focus-visible,#hya-cookie-notice a:focus-visible{outline:3px solid #B26A41;outline-offset:3px}' +
      '#hya-cookie-notice .hya-cookie-close{display:block;width:100%;min-height:36px;border:0;padding:6px;margin-top:8px;text-decoration:underline}' +
      '#hya-cookie-notice .hya-cookie-close[hidden]{display:none}' +
      '#hya-cookie-state:empty{display:none}' +
      '.hya-privacy-links a{text-underline-offset:3px}' +
      '@media(max-width:540px){#hya-cookie-notice{left:12px;bottom:12px;width:calc(100vw - 24px);max-height:calc(100dvh - 24px);padding:16px;font-size:14px}}';
    document.head.appendChild(style);
    notice = document.createElement('section');
    notice.id = 'hya-cookie-notice';
    notice.setAttribute('role', 'region');
    notice.setAttribute('aria-labelledby', 'hya-cookie-title');
    notice.setAttribute('tabindex', '-1');
    notice.hidden = true;
    notice.innerHTML = '<h2 id="hya-cookie-title">Your privacy choices</h2>' +
      '<p>May we use Google Analytics cookies to understand visits, traffic sources and which pages are useful? You can change your choice at any time using Cookie settings in the footer.</p>' +
      '<p><a class="hya-cookie-privacy">Read our privacy &amp; cookie notice</a></p>' +
      '<p id="hya-cookie-state" aria-live="polite"></p>' +
      '<div class="hya-cookie-actions"><button type="button" data-hya-choice="denied">Reject analytics</button>' +
      '<button type="button" data-hya-choice="granted">Accept analytics</button></div>' +
      '<button type="button" class="hya-cookie-close" hidden>Keep current choice</button>';
    notice.querySelector('.hya-cookie-privacy').href = privacyUrl;
    notice.querySelectorAll('[data-hya-choice]').forEach(function (button) {
      button.addEventListener('click', function () { choose(button.getAttribute('data-hya-choice')); });
    });
    notice.querySelector('.hya-cookie-close').addEventListener('click', closeNotice);
    document.body.appendChild(notice);
    if (!currentChoice) showNotice(false);
  }

  function linkPosition(link) {
    if (link.closest('header')) return 'header';
    if (link.closest('footer')) return 'footer';
    return 'content';
  }

  document.addEventListener('click', function (event) {
    var target = event.target instanceof Element ? event.target : event.target.parentElement;
    var settings = target && target.closest('[data-hya-cookie-settings]');
    if (settings) {
      event.preventDefault();
      showNotice(true);
      notice.querySelector('.hya-cookie-close').hidden = !currentChoice;
      return;
    }
    if (currentChoice !== 'granted' || !configured) return;
    var link = target && target.closest('a[href]');
    if (!link) return;
    var url;
    try { url = new URL(link.href, location.href); } catch (_) { return; }
    var name;
    if (url.hostname === 'wa.me' || url.hostname === 'api.whatsapp.com') {
      name = 'whatsapp_click';
    } else if (url.origin === location.origin && /\/contact\.html$/.test(url.pathname) &&
               /plan your visit/i.test(link.textContent)) {
      name = 'plan_visit_click';
    } else if (url.origin === location.origin && /\/HYA-(Prevention-Screening|Premium-DX)\.pdf$/i.test(url.pathname)) {
      // A separate named action; never manually emit GA4's automatic file_download event.
      name = 'brochure_click';
    }
    if (!name) return;
    var params = {
      send_to: measurementId,
      link_url: url.origin + url.pathname,
      link_text: link.textContent.replace(/\s+/g, ' ').trim().slice(0, 100),
      link_position: linkPosition(link)
    };
    if (name === 'brochure_click') params.brochure_name = /Premium-DX/i.test(url.pathname) ? 'DX' : 'Classic and Signature';
    // Keep internal navigation immediate while avoiding an unload-time lost hit.
    if (name === 'plan_visit_click' && event.button === 0 && !event.ctrlKey &&
        !event.metaKey && !event.shiftKey && !event.altKey &&
        (!link.target || link.target === '_self') && !link.hasAttribute('download')) {
      try {
        params.page_location = measuredLocation();
        params.page_referrer = measuredReferrer();
        sessionStorage.setItem(pendingClickKey, JSON.stringify({
          target: url.origin + url.pathname,
          time: Date.now(),
          params: params
        }));
        return;
      } catch (_) { /* Fall back to immediate measurement if storage is blocked. */ }
    }
    window.gtag('event', name, params);
    // Modified clicks and links opening another tab keep their native behavior.
  }, true);

  window.addEventListener('storage', function (event) {
    if (event.key !== consentKey && event.key !== null) return;
    applyChoice(readChoice());
    if (notice) {
      if (currentChoice) notice.hidden = true;
      else showNotice(false);
    }
  });

  applyChoice(readChoice());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installNotice, { once: true });
  else installNotice();
})();
