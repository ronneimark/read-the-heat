/* Work-Rest Cycles - language links.
 * Adding ?lang=es (or tl, pl, uk, fr, ur, ar, ru, ko, vi, de, zh-CN, yue, en)
 * to the page address opens it already translated. Sets the googtrans cookie
 * before Google's script loads so the choice carries across sessions.
 * Must load in <head>, before the translate script.
 */
(function() {
  var VALID = ['en','es','tl','pl','uk','fr','ur','ar','ru','ko','vi','de','zh-CN','yue'];
  var params = new URLSearchParams(window.location.search);
  var lang = params.get('lang') || '';
  if (!lang || VALID.indexOf(lang) === -1) return;

  var cookieLang = lang === 'yue' ? 'zh-HK' : lang;
  var host = window.location.hostname;
  var domains = ['', host.indexOf('.') > -1 ? '; domain=.' + host.replace(/^www\./, '') : ''];
  domains.forEach(function(d) {
    if (lang === 'en') {
      document.cookie = 'googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT' + d;
    } else {
      document.cookie = 'googtrans=/en/' + cookieLang + '; path=/; max-age=31536000' + d;
    }
  });

  params.delete('lang');
  var rest = params.toString();
  var cleanUrl = window.location.pathname + (rest ? '?' + rest : '');
  if (lang === 'en') {
    history.replaceState(null, '', cleanUrl);
    return;
  }
  history.replaceState(null, '', cleanUrl + '#googtrans(en|' + cookieLang + ')');
  var root = document.documentElement;
  var cleaned = false;
  function cleanUp() {
    if (cleaned || !/translated-/.test(root.className)) return;
    cleaned = true;
    history.replaceState(null, '', cleanUrl);
  }
  new MutationObserver(cleanUp).observe(root, { attributes: true, attributeFilter: ['class'] });
  setTimeout(function() {
    if (/translated-/.test(root.className)) return;
    var combo = document.querySelector('select.goog-te-combo');
    if (combo) {
      combo.value = cookieLang;
      combo.dispatchEvent(new Event('change'));
    }
  }, 6000);
})();
