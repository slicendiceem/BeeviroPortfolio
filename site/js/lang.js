/* Beeviro — which language, decided in the <head>.
 *
 * This is split out of i18n.js for two reasons, and both are user-visible:
 *
 * 1. NO DIRECTION FLASH. i18n.js sits at the bottom of the body, so an Arabic
 *    reader used to get the whole document parsed and painted left-to-right and
 *    then flipped. Deciding here means `dir="rtl"` is on <html> before the
 *    stylesheet has anything to lay out.
 *
 * 2. THE ARABIC DATA IS ONLY FETCHED IN ARABIC. clients.ar.js is 62 KB of prose
 *    that an English reader never reads — a fifth of this site's whole script
 *    payload, and parse time on a cheap phone is not free. The body writes that
 *    tag only when BV_LANG says to.
 *
 * Nothing here touches content. If it fails, i18n.js resolves the language on
 * its own exactly as before and the page is correct, just with a flash.
 */
(function () {
  'use strict';

  var KEY = 'bv:lang';
  var SUPPORTED = ['en', 'ar'];

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  /* A ?lang= or #lang= wins over the stored choice, so a link can be shared in
     a specific language — which is the whole point of sending someone a case. */
  var m = /[?&#]lang=(ar|en)\b/i.exec(location.href);
  var lang = m ? m[1].toLowerCase() : stored();
  if (SUPPORTED.indexOf(lang) < 0) {
    lang = /^ar\b/i.test(navigator.language || '') ? 'ar' : 'en';
  }

  var html = document.documentElement;
  html.setAttribute('lang', lang);
  html.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
  html.classList.toggle('bv-ar', lang === 'ar');

  window.BV_LANG = lang;
})();
