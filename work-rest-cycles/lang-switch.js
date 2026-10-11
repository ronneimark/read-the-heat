/* Work-Rest Cycles - language menu.
 *
 * Adds a globe + language dropdown to the strip below the banner.
 * Languages: English, Español, Polski, Українська, Français, العربية,
 *            中文（普通话）, 粵語（廣東話）
 *
 * Usage: <script src="./lang-link.js"></script> in <head>
 *        <script src="./lang-switch.js" defer></script> before </body>
 */
(function () {
  'use strict';
  var LANGS = [
    ['en',    'English'],
    ['es',    'Español'],
    ['pl',    'Polski'],
    ['uk',    'Українська'],
    ['fr',    'Français'],
    ['ar',    'العربية'],
    ['zh-CN', '中文（普通话）'],
    ['yue',   '粵語（廣東話）']
  ];

  function current() {
    var m = document.cookie.match(/(?:^|;\s*)googtrans=([^;]*)/);
    if (!m) return 'en';
    var parts = decodeURIComponent(m[1]).split('/');
    var code = (parts[parts.length - 1] || '').toLowerCase();
    // zh-HK maps back to yue in our menu
    if (code === 'zh-hk') return 'yue';
    return LANGS.some(function (l) { return l[0].toLowerCase() === code; }) ? code : 'en';
  }

  function go(code) {
    var params = new URLSearchParams(window.location.search);
    params.set('lang', code);
    window.location.href = window.location.pathname + '?' + params.toString();
  }

  var css = [
    '.wrc-lang-switch { display: flex; align-items: center; gap: 5px; flex-shrink: 0;',
    '  font-family: inherit; font-size: 13px; }',
    '.wrc-banner-strip-inner > .wrc-lang-switch { margin-left: auto; }',
    '.wrc-lang-switch .wrc-globe { font-size: 15px; line-height: 1; }',
    '.wrc-lang-switch select { font: inherit; font-weight: 600; color: #001E62;',
    '  background: #fff; border: 1px solid #c5cfdd; border-radius: 4px;',
    '  padding: 2px 5px; cursor: pointer; }',
    '.wrc-lang-switch select:focus-visible { outline: 2px solid #005FCC; outline-offset: 1px; }',
    /* Suppress Google Translate's own UI chrome */
    '#wrc-gt-widget, .goog-te-banner-frame, #goog-te-banner-frame,',
    '.VIpgJd-ZVi9od-ORHb-OEVmcd.skiptranslate { display: none !important;',
    '  visibility: hidden !important; height: 0 !important; }',
    'body { top: 0 !important; }'
  ].join('\n');

  function ensureGoogleTranslate() {
    if (document.querySelector('script[src*="translate_a/element.js"]') ||
        typeof window.googleTranslateElementInit === 'function') return;
    var holder = document.createElement('div');
    holder.id = 'wrc-gt-widget';
    document.body.appendChild(holder);
    window.googleTranslateElementInit = function () {
      new google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,es,pl,uk,fr,ar,zh-CN,zh-HK',
        layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
        autoDisplay: false
      }, 'wrc-gt-widget');
    };
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.body.appendChild(s);
    var fix = function () {
      if (document.body.style.top && document.body.style.top !== '0px')
        document.body.style.top = '0px';
    };
    new MutationObserver(fix).observe(document.body, { attributes: true, attributeFilter: ['style'] });
  }

  function start() {
    if (document.querySelector('.wrc-lang-switch')) return;

    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var lang = current();
    var wrap = document.createElement('label');
    wrap.className = 'wrc-lang-switch notranslate';
    wrap.setAttribute('translate', 'no');
    wrap.innerHTML = '<span class="wrc-globe" aria-hidden="true">&#127760;</span>';

    var sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Select language');
    LANGS.forEach(function (l) {
      var o = document.createElement('option');
      o.value = l[0];
      o.textContent = l[1];
      o.lang = l[0] === 'yue' ? 'zh-HK' : l[0];
      if (l[0] === lang) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () { if (sel.value !== lang) go(sel.value); });
    wrap.appendChild(sel);

    var inner = document.querySelector('.wrc-banner-strip-inner');
    if (inner) {
      inner.appendChild(wrap);
    }

    ensureGoogleTranslate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
