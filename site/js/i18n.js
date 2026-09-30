/* Beeviro — bilingual layer (English · العربية).
 *
 * Beeviro works in Egypt, Saudi Arabia, the UAE and Qatar. A portfolio for that
 * market that only reads in English is asking most of its audience to do the
 * translating, so the whole site — chrome, section copy, and all twenty-five
 * case files — reads in Arabic too, right to left.
 *
 * HOW IT WORKS, AND WHY THIS WAY
 *
 * 1. Language is decided HERE, before beeviro.js renders anything. Every string
 *    the page builds comes from T(), and the client records are merged with
 *    clients.ar.js in place. Nothing downstream has to know there are two
 *    languages; it just reads BV_CLIENTS and asks T() for its labels.
 *
 * 2. Switching language RELOADS the page. Half this site is generated markup —
 *    twenty-five dossiers, four running strips, a nineteen-cell lattice, all
 *    measured in pixels at build time — and re-rendering it live in the other
 *    direction is how you get a mirrored layout with unmirrored measurements.
 *    One reload is honest and correct.
 *
 * 3. The Arabic data is an OVERLAY (see clients.ar.js). A missing translation
 *    falls back to English rather than to an empty box, so a half-finished
 *    record degrades to a readable one.
 *
 * DIRECTION IS NOT A TRANSLATION PROBLEM. `dir="rtl"` is set on <html> so the
 * browser handles bidi for us, and the stylesheet's [dir="rtl"] block flips the
 * handful of things that are positioned rather than flowed — the drip rail, the
 * dossier rail border, the marquee travel, the card arrow.
 */
(function () {
  'use strict';

  var KEY = 'bv:lang';
  var SUPPORTED = ['en', 'ar'];

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function remember(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  /* A ?lang= or #lang= in the URL wins, so a link can be shared in a specific
     language — which is the whole point of sending someone a case file. */
  function fromUrl() {
    var m = /[?&#]lang=(ar|en)\b/i.exec(location.href);
    return m ? m[1].toLowerCase() : null;
  }

  /* js/lang.js decides this in the <head>, so `dir` is on <html> before the
     stylesheet lays anything out and the Arabic data is only fetched in Arabic.
     The resolution is repeated here only as a fallback for the case where that
     file failed to load — same rules, same order, one source of truth for the
     ANSWER even though the code appears twice. */
  var LANG = window.BV_LANG;
  if (SUPPORTED.indexOf(LANG) < 0) LANG = fromUrl() || stored();
  if (SUPPORTED.indexOf(LANG) < 0) {
    LANG = /^ar\b/i.test(navigator.language || '') ? 'ar' : 'en';
  }

  var RTL = LANG === 'ar';
  var html = document.documentElement;
  html.setAttribute('lang', LANG);
  html.setAttribute('dir', RTL ? 'rtl' : 'ltr');
  html.classList.toggle('bv-ar', RTL);

  /* ---- the dictionary -----------------------------------------------------
     Only strings the PAGE owns. Client copy lives in clients.js/clients.ar.js
     where it belongs, next to the record it describes. */
  var STR = {
    en: {
      'meta.title': 'Beeviro — Digital Marketing Agency',
      'nav.method': 'Method', 'nav.services': 'Services', 'nav.work': 'Work',
      'nav.creative': 'Creative', 'nav.voices': 'Voices', 'nav.contact': 'Contact',
      'nav.cta': 'Start a project', 'nav.sections': 'Sections',
      'nav.skip': 'Skip to content', 'nav.open': 'Open menu', 'nav.close': 'Close menu',
      'nav.region': 'Egypt & the Gulf',
      'lang.switch': 'العربية', 'lang.label': 'اعرض الموقع بالعربية',
      'perf.full': 'Full motion', 'perf.lite': 'Lite motion',
      'perf.label': 'Reduce animation for slower devices',

      'hero.eyebrow': 'Digital marketing agency · Egypt & the Gulf',
      'hero.title': 'We turn audiences into customers',
      'hero.lede': 'Beeviro is a client-generating system, not a content service. We build the whole path — diagnosis, positioning, creative, funnel and media — then run it against numbers that matter.',
      'hero.cta1': 'See the work', 'hero.cta2': 'How we work',
      'hero.scroll': 'SCROLL TO EXPLORE',

      'count.eyebrow': 'Counted, not claimed',
      'count.h2': 'Every number here<br>points at something<br>you can open.',
      'stat.1.l': 'Brands served', 'stat.1.n': 'Every one of them is on this page, with its journey written out.',
      'stat.2.l': 'Markets', 'stat.2.n': 'Egypt, Saudi Arabia, the UAE and Qatar.',
      'stat.3.l': 'Files delivered', 'stat.3.n': 'Counted across 63 client deliverable folders — designs, reels, logos, decks.',
      'stat.4.l': 'Strategy decks', 'stat.4.n': '232 pages of market analysis, personas, funnels and KPIs written before the work started.',

      'method.eyebrow': 'The method',
      'method.h2': 'Six cells,<br>built in order.',
      'method.lede': 'Every engagement runs the same six stages. Nothing gets designed before the market is read, and nothing gets bought before the position is decided. Open any client below and you will see these six again, filled in with their specifics.',

      'svc.eyebrow': 'Services',
      'svc.h2': 'What we actually<br>do all day.',
      'svc.1.t': 'Strategy & SWOT', 'svc.1.d': 'Market, competitor and audience analysis, written down before anything is designed.',
      'svc.2.t': 'Brand Identity', 'svc.2.d': 'Logo systems, colour, type and guidelines — built bilingual where the market needs it.',
      'svc.3.t': 'Media Buying', 'svc.3.d': 'Meta, TikTok and Google, structured by funnel stage and consolidated into what works.',
      'svc.4.t': 'Content Production', 'svc.4.d': 'Designs, reels, photoshoots and behind-the-scenes, produced at campaign volume.',
      'svc.5.t': 'Funnels & Web', 'svc.5.d': 'Conversion-focused sites, landing pages and sales funnels with qualifying built in.',
      'svc.6.t': 'UGC & Creators', 'svc.6.d': 'Creator-style and celebrity content where borrowed trust beats brand voice.',
      'svc.7.t': 'Performance Analysis', 'svc.7.d': 'Campaign reporting against KPIs, with budget moved to the winners monthly.',
      'svc.8.t': 'Positioning', 'svc.8.d': 'The one claim a brand can own and defend — usually the hardest part of the job.',

      'work.eyebrow': 'Selected work',
      'work.h2': 'Twenty-five brands.<br>Every journey shown<br>end to end.',
      'work.lede': 'Open a card to walk the whole engagement — first contact, diagnosis, positioning, build, launch, outcome — with the designs and the campaign numbers attached. Where a figure is a target rather than a delivered result, it says so.',
      'work.more': 'Show more work', 'work.less': 'Show fewer',
      'work.showing': 'Showing {a} of {b}',

      'testi.eyebrow': 'In their own words',
      'testi.h2': 'Clients, on camera.',
      'testi.lede': 'Unscripted and unedited beyond a trim. Pick one — nothing starts on its own.',
      'testi.play': 'Play', 'testi.n': 'testimonial {i}',

      'creative.eyebrow': 'The output',
      'creative.h2': 'Roughly nine hundred<br>files delivered.',
      'creative.lede': 'A sample of the design work, pulled straight from the client deliverable folders. Click any tile to open it.',

      'voices.eyebrow': 'What the work is for',
      'voices.quote': '“Beeviro’s client-generating system isn’t just content. We transform targeted audiences into <span class="bv-amber">loyal customers</span> through meaningful interactions, delivering real, measurable results.”',
      'voices.who': 'The line that opens every strategy we write',

      'contact.eyebrow': 'Start the conversation',
      'contact.h2': 'Let’s build<br>your comb.',
      'contact.lede': 'Tell us the number you need to move. We will tell you what it takes to move it — and show you the client we did it for.',

      'foot.about': 'A digital marketing agency building strategy, brand, creative and media systems for brands across Egypt and the Gulf.',
      'foot.touch': 'Get in touch',
      'foot.rights': 'Beeviro LLC. All rights reserved.',
      'foot.note': 'Client figures published with permission. Budgets, competitor analysis and personal data withheld.',

      'case.aria': 'Case study', 'case.close': 'Close case study',
      'case.prev': '← Previous client', 'case.next': 'Next client →',
      'case.n': 'Case {i} / {n}',
      'case.sector': 'Sector', 'case.market': 'Market', 'case.year': 'Year', 'case.site': 'Site',
      'case.result': 'Outcome — delivered',
      'case.goal': 'Outcome — the target this was built to hit',
      'case.goalNote': 'This is the target the strategy was designed around, not a reported result. We only publish outcomes we can source.',
      'case.metrics': 'The numbers · tap any card for its source',
      'case.tap': 'tap',
      'case.journey': 'The journey — first contact to outcome',
      'case.campaign': 'Campaign readout',
      'case.redacted': 'redacted',
      'case.film': 'The film — a real deliverable, not a still of one',
      'case.filmPlay': 'Play',
      'case.work': 'The work · {n} pieces',
      'case.spread': 'Spread all {n}', 'case.run': 'Back to the run',
      'card.kindResult': 'Delivered result', 'card.kindGoal': 'Strategy target',
      'card.meta': 'Case {i} · {country} · {year}',
      'card.open': 'Open case',
      'cursor.view': 'View',

      'lb.close': 'Close', 'lb.prev': 'Previous', 'lb.next': 'Next',

      'mq1': ['Media Buying', 'Brand Identity', 'Content Strategy', 'Funnels', 'UGC',
        'Web & E-commerce', 'Reels', 'SWOT & Positioning'],
      'mq2': ['Strategy', 'Design', 'Video', 'Performance', 'Egypt', 'Saudi Arabia', 'UAE', 'Qatar'],
      'hive.self': 'Our own reel', 'hive.selfCta': 'See the work',
      'hive.selfLine': 'The studio behind every case in this comb.',
    },

    ar: {
      'meta.title': 'Beeviro — وكالة تسويق رقمي',
      'nav.method': 'المنهج', 'nav.services': 'الخدمات', 'nav.work': 'الأعمال',
      'nav.creative': 'الإنتاج', 'nav.voices': 'صوتنا', 'nav.contact': 'تواصل',
      'nav.cta': 'ابدأ مشروعك', 'nav.sections': 'الأقسام',
      'nav.skip': 'تخطَّ إلى المحتوى', 'nav.open': 'افتح القائمة', 'nav.close': 'أغلق القائمة',
      'nav.region': 'مصر والخليج',
      'lang.switch': 'English', 'lang.label': 'View this site in English',
      'perf.full': 'حركة كاملة', 'perf.lite': 'حركة مخفّفة',
      'perf.label': 'تقليل الحركة للأجهزة الأبطأ',

      'hero.eyebrow': 'وكالة تسويق رقمي · مصر والخليج',
      'hero.title': 'نحوّل الجمهور إلى عملاء',
      'hero.lede': 'Beeviro نظام لتوليد العملاء، لا خدمة محتوى. نبني المسار كاملًا — تشخيص وتموضع ومحتوى ومسار بيعي وإعلانات — ثم نُشغّله أمام أرقام لها معنى.',
      'hero.cta1': 'شاهد الأعمال', 'hero.cta2': 'كيف نعمل',
      'hero.scroll': 'مرّر للاستكشاف',

      'count.eyebrow': 'محسوب، لا مُدّعى',
      'count.h2': 'كل رقم هنا<br>يشير إلى شيء<br>تستطيع فتحه.',
      'stat.1.l': 'علامة خدمناها', 'stat.1.n': 'كلها موجودة على هذه الصفحة، ورحلتها مكتوبة بالكامل.',
      'stat.2.l': 'أسواق', 'stat.2.n': 'مصر والسعودية والإمارات وقطر.',
      'stat.3.l': 'ملفًا سُلّم', 'stat.3.n': 'محسوبة عبر 63 مجلد تسليمات للعملاء — تصاميم وريلز وشعارات وعروض.',
      'stat.4.l': 'عرض استراتيجية', 'stat.4.n': '232 صفحة من تحليل السوق والشخصيات والمسارات ومؤشرات الأداء، كُتبت قبل بدء العمل.',

      'method.eyebrow': 'المنهج',
      'method.h2': 'ست خلايا،<br>تُبنى بالترتيب.',
      'method.lede': 'كل تعاون يمرّ بالمراحل الست نفسها. لا يُصمَّم شيء قبل قراءة السوق، ولا تُشترى إعلانات قبل تحديد التموضع. افتح أي عميل بالأسفل وستجد هذه الست نفسها، مملوءة بتفاصيله هو.',

      'svc.eyebrow': 'الخدمات',
      'svc.h2': 'ما نفعله فعلًا<br>طوال اليوم.',
      'svc.1.t': 'استراتيجية وتحليل SWOT', 'svc.1.d': 'تحليل السوق والمنافسين والجمهور، مكتوبًا قبل أن يُصمَّم أي شيء.',
      'svc.2.t': 'الهوية البصرية', 'svc.2.d': 'أنظمة شعارات وألوان وخطوط وأدلة استخدام — ثنائية اللغة حيثما احتاج السوق ذلك.',
      'svc.3.t': 'شراء الإعلانات', 'svc.3.d': 'Meta وتيك توك وGoogle، مُهيكلة حسب مرحلة المسار ومُجمَّعة فيما ينجح.',
      'svc.4.t': 'إنتاج المحتوى', 'svc.4.d': 'تصاميم وريلز وجلسات تصوير وكواليس، بحجم إنتاج الحملات.',
      'svc.5.t': 'المسارات والمواقع', 'svc.5.d': 'مواقع وصفحات هبوط ومسارات بيع مبنية على التحويل، بتأهيل مدمج.',
      'svc.6.t': 'محتوى الصنّاع والمشاهير', 'svc.6.d': 'محتوى بأسلوب الصنّاع والمشاهير حيث تتفوّق الثقة المستعارة على صوت العلامة.',
      'svc.7.t': 'تحليل الأداء', 'svc.7.d': 'تقارير حملات أمام مؤشرات الأداء، مع نقل الميزانية شهريًا إلى الرابح.',
      'svc.8.t': 'التموضع', 'svc.8.d': 'الادّعاء الواحد الذي تستطيع العلامة امتلاكه والدفاع عنه — وهو غالبًا أصعب جزء في العمل.',

      'work.eyebrow': 'أعمال مختارة',
      'work.h2': 'خمس وعشرون علامة.<br>كل رحلة معروضة<br>من أولها لآخرها.',
      'work.lede': 'افتح أي بطاقة لتمشي التعاون كاملًا — أول تواصل، تشخيص، تموضع، تنفيذ، إطلاق، نتيجة — بالتصاميم وأرقام الحملات مرفقة. وحين يكون الرقم هدفًا لا نتيجة محقّقة، نقول ذلك صراحة.',
      'work.more': 'اعرض أعمالًا أكثر', 'work.less': 'اعرض أقل',
      'work.showing': 'معروض {a} من {b}',

      'testi.eyebrow': 'بكلماتهم هم',
      'testi.h2': 'عملاء، أمام الكاميرا.',
      'testi.lede': 'بدون سيناريو وبدون مونتاج غير القص. اختر واحدة — لا شيء يبدأ من تلقاء نفسه.',
      'testi.play': 'تشغيل', 'testi.n': 'الشهادة {i}',

      'creative.eyebrow': 'المُخرَجات',
      'creative.h2': 'نحو تسعمائة<br>ملف مُسلَّم.',
      'creative.lede': 'عيّنة من أعمال التصميم، مأخوذة مباشرة من مجلدات تسليمات العملاء. اضغط أي قطعة لفتحها.',

      'voices.eyebrow': 'ما الهدف من كل هذا',
      'voices.quote': '«نظام Beeviro لتوليد العملاء ليس مجرد محتوى. نحوّل الجماهير المستهدفة إلى <span class="bv-amber">عملاء أوفياء</span> عبر تفاعلات ذات معنى، ونحقّق نتائج حقيقية وقابلة للقياس.»',
      'voices.who': 'السطر الذي تبدأ به كل استراتيجية نكتبها',

      'contact.eyebrow': 'ابدأ الحديث',
      'contact.h2': 'لنبنِ<br>خليتك.',
      'contact.lede': 'أخبرنا بالرقم الذي تريد تحريكه. وسنخبرك بما يلزم لتحريكه — ونُريك العميل الذي فعلناها معه.',

      'foot.about': 'وكالة تسويق رقمي تبني أنظمة استراتيجية وعلامة ومحتوى وإعلانات لعلامات في مصر والخليج.',
      'foot.touch': 'تواصل معنا',
      'foot.rights': 'Beeviro LLC. جميع الحقوق محفوظة.',
      'foot.note': 'أرقام العملاء منشورة بإذنهم. الميزانيات وتحليلات المنافسين والبيانات الشخصية محجوبة.',

      'case.aria': 'دراسة حالة', 'case.close': 'إغلاق دراسة الحالة',
      /* Arrows are not bidi-mirrored, so they have to be authored for the
         direction they will be read in: back is to the RIGHT here, forward is
         to the left. The glyph sits on the side it points to. */
      'case.prev': '→ العميل السابق', 'case.next': 'العميل التالي ←',
      /* NOT "حالة {i} / {n}". A slash and spaces between two numbers are
         neutral characters, so in an RTL paragraph they take the paragraph's
         direction and the two numbers swap: "01 / 25" renders as "25 / 01".
         An Arabic word between them is a strong RTL character and holds each
         number in place. */
      'case.n': 'حالة {i} من {n}',
      'case.sector': 'القطاع', 'case.market': 'السوق', 'case.year': 'السنة', 'case.site': 'الموقع',
      'case.result': 'النتيجة — محقّقة',
      'case.goal': 'النتيجة — الهدف الذي بُنيت عليه',
      'case.goalNote': 'هذا هو الهدف الذي صُمّمت حوله الاستراتيجية، وليس نتيجة مُبلَّغًا عنها. لا ننشر إلا النتائج التي نملك مصدرًا لها.',
      'case.metrics': 'الأرقام · اضغط أي بطاقة لترى مصدرها',
      'case.tap': 'اضغط',
      'case.journey': 'الرحلة — من أول تواصل إلى النتيجة',
      'case.campaign': 'قراءة الحملة',
      'case.redacted': 'محجوب',
      'case.film': 'الفيلم — تسليم حقيقي، لا لقطة منه',
      'case.filmPlay': 'تشغيل',
      'case.work': 'الأعمال · {n} قطعة',
      'case.spread': 'افرد الـ {n} كلها', 'case.run': 'عُد إلى الشريط',
      'card.kindResult': 'نتيجة محقّقة', 'card.kindGoal': 'هدف الاستراتيجية',
      'card.meta': 'حالة {i} · {country} · {year}',
      'card.open': 'افتح الحالة',
      'cursor.view': 'عرض',

      'lb.close': 'إغلاق', 'lb.prev': 'السابق', 'lb.next': 'التالي',

      'mq1': ['شراء إعلانات', 'هوية بصرية', 'استراتيجية محتوى', 'مسارات بيع', 'محتوى صنّاع',
        'مواقع ومتاجر', 'ريلز', 'تحليل وتموضع'],
      'mq2': ['استراتيجية', 'تصميم', 'فيديو', 'أداء', 'مصر', 'السعودية', 'الإمارات', 'قطر'],
      'hive.self': 'ريلنا نحن', 'hive.selfCta': 'شاهد الأعمال',
      'hive.selfLine': 'الاستوديو وراء كل حالة في هذه الخلية.',
    },
  };

  var DICT = STR[LANG] || STR.en;

  /* Fall back to English rather than to the raw key: an untranslated line
     should read as English, never as `case.journey`. */
  function t(key, vars) {
    var v = DICT[key];
    if (v == null) v = STR.en[key];
    if (v == null) return key;
    if (typeof v === 'string' && vars) {
      v = v.replace(/\{(\w+)\}/g, function (m, k) {
        return vars[k] != null ? vars[k] : m;
      });
    }
    return v;
  }

  /* ---- merge the Arabic client records over the English ones -------------- */
  function mergeClients() {
    if (!RTL) return;
    var AR = window.BV_CLIENTS_AR || {};
    var STAGES_AR = window.BV_STAGES_AR || {};

    (window.BV_STAGES || []).forEach(function (s) {
      var a = STAGES_AR[s.key];
      if (!a) return;
      if (a.label) s.label = a.label;
      if (a.hint) s.hint = a.hint;
    });

    (window.BV_CLIENTS || []).forEach(function (c) {
      var a = AR[c.slug];
      if (!a) return;
      ['name', 'industry', 'country', 'tagline', 'summary', 'workNote'].forEach(function (k) {
        if (a[k]) c[k] = a[k];
      });
      if (a.services) c.services = a.services;
      if (a.journey) {
        Object.keys(a.journey).forEach(function (k) { c.journey[k] = a.journey[k]; });
      }
      // The VALUE and the KIND stay English-side. Only the wording moves.
      if (a.outcome && a.outcome.headline) c.outcome.headline = a.outcome.headline;
      // The film's caption is translated; its `src` is not — one source of truth
      // for which file this is, in clients.js, where the rest of the record lives.
      if (a.film && a.film.note && c.film) c.film.note = a.film.note;
      if (a.metrics && c.metrics) {
        c.metrics.forEach(function (m, i) {
          var am = a.metrics[i];
          if (!am) return;
          if (am.l) m.l = am.l;
          if (am.note) m.note = am.note;
          if (am.v) m.v = am.v;
        });
      }
      if (a.campaign && c.campaign) {
        ['title', 'note', 'split'].forEach(function (k) {
          if (a.campaign[k]) c.campaign[k] = a.campaign[k];
        });
        // rows are [label, value] — only the label is translated, and by index,
        // so a figure can never be attached to the wrong caption.
        if (a.campaign.rows) {
          c.campaign.rows.forEach(function (r, i) {
            if (a.campaign.rows[i]) r[0] = a.campaign.rows[i];
          });
        }
      }
    });
  }
  mergeClients();

  /* ---- static markup ------------------------------------------------------
     Everything carrying data-i18n / data-i18n-html / data-i18n-attr. Runs on
     DOMContentLoaded because this script sits above <body>. */
  function paintStatic() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (n) {
      n.textContent = t(n.getAttribute('data-i18n'));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-html]'), function (n) {
      n.innerHTML = t(n.getAttribute('data-i18n-html'));
    });
    // "aria-label:key, title:key"
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n-attr]'), function (n) {
      n.getAttribute('data-i18n-attr').split(',').forEach(function (pair) {
        var bits = pair.split(':');
        if (bits.length === 2) n.setAttribute(bits[0].trim(), t(bits[1].trim()));
      });
    });
    if (DICT['meta.title']) document.title = t('meta.title');
    var sw = document.querySelectorAll('[data-lang-toggle]');
    Array.prototype.forEach.call(sw, function (b) {
      b.textContent = t('lang.switch');
      b.setAttribute('aria-label', t('lang.label'));
      b.setAttribute('lang', RTL ? 'en' : 'ar');
    });
  }

  /* Painted IMMEDIATELY, not on DOMContentLoaded. This script sits in the body
     script block below all the markup, so every node already exists — and
     beeviro.js runs on the very next line. It splits the hero headline into
     per-letter spans; if the translation landed after that split it would
     overwrite the spans with plain text and the reveal would silently die. */
  if (document.body) paintStatic();
  else document.addEventListener('DOMContentLoaded', paintStatic);

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-lang-toggle]');
    if (!b) return;
    e.preventDefault();
    var next = RTL ? 'en' : 'ar';
    remember(next);
    // Drop any ?lang= already in the URL so the stored choice is not overridden
    // by a stale query on the very next load.
    var url = location.pathname + location.search.replace(/([?&])lang=(ar|en)&?/i, '$1')
      .replace(/[?&]$/, '');
    location.replace(url + (location.hash || ''));
  });

  window.BV_I18N = { lang: LANG, rtl: RTL, t: t, set: function (l) { remember(l); location.reload(); } };
  window.T = t;
})();
