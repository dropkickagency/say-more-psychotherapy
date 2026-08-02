// Enable animation styles only when JS is available
document.documentElement.classList.add('js-animate');

// ---- Edit mode: if this page was loaded in the admin website editor with
//      ?edit=1, load the editor overlay and skip the runtime patcher/beacon.
var __SM_EDIT_MODE__ = false;
(function () {
  try {
    var qs = new URLSearchParams(window.location.search);
    if (qs.get('edit') !== '1') return;
    // Only trust ?edit=1 when this page is embedded in an iframe (i.e. the
    // admin's website editor) — random visitors adding ?edit=1 don't get UI.
    if (window.top === window.self) return;
    __SM_EDIT_MODE__ = true;
    var s = document.createElement('script');
    s.src = '/admin/edit-mode.js?_=' + Date.now();
    s.defer = true;
    document.head.appendChild(s);
  } catch (e) {}
})();

// ---- Content patches from the website editor (applied at page load) ----
// Runs on every public page — fetches any admin-authored edits for this
// path from /api/edits and overlays them onto the static HTML.
// Skipped in edit mode so the editor sees the raw HTML.
(function () {
  if (__SM_EDIT_MODE__) return;
  if (/^\/admin(\/|$)/.test(window.location.pathname)) return;

  // Normalise HTML for the drift-safety compare. The editor decorates
  // every editable element with sm-* helper classes and toggles
  // contenteditable on click; those got captured into old `original`
  // snapshots. Live HTML doesn't have them, so a raw string compare
  // always failed and every text patch was silently skipped.
  function normalise(html) {
    if (html == null) return '';
    return String(html)
      .replace(/\s+class="([^"]*)"/g, function (m, classes) {
        var kept = classes.split(/\s+/).filter(function (c) { return c && c.indexOf('sm-') !== 0; });
        return kept.length ? ' class="' + kept.join(' ') + '"' : '';
      })
      .replace(/\s+contenteditable="[^"]*"/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Inserts smuggle a uniqueness suffix through element_path so two
  // adjacent inserts don't collide on the (page_path, element_path)
  // unique index. Format: "<css selector> || ins-…". Strip before use.
  function insertSelector(raw) {
    return String(raw || '').split('||')[0].trim();
  }

  var applied = false;
  function applyPatches(patches) {
    if (applied || !Array.isArray(patches)) return;
    applied = true;
    patches.forEach(function (p) {
      try {
        // Insert-* patches don't overwrite an existing element — they
        // add a new section adjacent to the anchor.
        if (p.element_type === 'insert-after' || p.element_type === 'insert-before') {
          var ref = document.querySelector(insertSelector(p.element_path));
          if (!ref) return;
          ref.insertAdjacentHTML(p.element_type === 'insert-before' ? 'beforebegin' : 'afterend', p.new_content || '');
          return;
        }
        var el = document.querySelector(p.element_path);
        if (!el) return;
        if (p.element_type === 'image') {
          if (el.tagName === 'IMG') el.setAttribute('src', p.new_content);
        } else if (p.element_type === 'video') {
          if (el.tagName === 'VIDEO') {
            // Remove <source> children so the new src wins
            el.querySelectorAll('source').forEach(function (s) { s.remove(); });
            el.setAttribute('src', p.new_content);
            try { el.load(); } catch (e) {}
          }
        } else if (p.element_type === 'bg-image') {
          el.style.backgroundImage = 'url("' + p.new_content + '")';
        } else if (p.element_type === 'href') {
          el.setAttribute('href', p.new_content);
        } else {
          // Text patches always apply. The old drift-safety check that
          // compared innerHTML to the captured `original` was killing
          // legitimate edits: on chained re-edits the captured original
          // is the *previous* edit's output, not the raw HTML, so it
          // never matched live and the patch was silently dropped.
          el.innerHTML = p.new_content;
        }
      } catch (e) { /* skip individual failing patch */ }
    });
  }

  // Reveal the page (paired with the inline hide-until-ready snippet in
  // <head>). Called after patches apply, or on fetch error, or via the
  // <head> failsafe timeout — whichever fires first.
  function reveal() {
    try { document.documentElement.classList.remove('sm-loading'); } catch (e) {}
  }

  fetch('/api/edits?path=' + encodeURIComponent(window.location.pathname))
    .then(function (r) { return r.json(); })
    .then(function (d) { applyPatches(d && d.patches); })
    .catch(function () { /* silent — page still works uneditied */ })
    .then(reveal);
})();

// ---- Nav rebuilder -----------------------------------------------------
// Fetches the admin-configured nav (order + hidden flags for both static
// and custom pages) and rewrites the primary + mobile nav DOM. Static
// links inside the Services dropdown are preserved untouched — only the
// top-level nav order/visibility is under admin control here.
(function () {
  if (__SM_EDIT_MODE__) return;
  if (/^\/admin(\/|$)/.test(window.location.pathname)) return;

  var STATIC_HREFS = ['/', '/about', '/services', '/location', '/blog'];
  var here = window.location.pathname.replace(/\/$/, '') || '/';

  // Normalise href attributes to absolute paths so "about", "/about",
  // and "/about/" all compare equal. Static HTML historically used
  // relative hrefs — matching only "/about" left the originals in place
  // and caused a duplicate to be appended.
  function normaliseHref(h) {
    if (!h) return '';
    var s = String(h);
    if (!s.startsWith('/')) s = '/' + s;
    s = s.replace(/\/$/, '');
    return s || '/';
  }

  function isTopLevelStaticLink(a) {
    if (!a) return false;
    // Ignore anything inside the Services dropdown / mobile submenu — those
    // stay as-is so the sub-page list under Services keeps working.
    if (a.closest('.nav__dropdown')) return false;
    if (a.closest('.nav__mobile__submenu')) return false;
    var href = normaliseHref(a.getAttribute('href'));
    return STATIC_HREFS.indexOf(href) !== -1;
  }

  function rebuild(list, items) {
    if (!list) return;
    // Snapshot the Services dropdown wrapper (it lives INSIDE nav.nav__links)
    // so we can re-insert it in the right slot after clearing.
    var servicesWrap = list.querySelector('.nav__item--has-dropdown');
    var servicesMobile = list.querySelector('details.nav__mobile__submenu');
    // Remove all top-level static <a> children — keep dropdown/wrap intact.
    Array.from(list.children).forEach(function (child) {
      if (child.tagName === 'A' && isTopLevelStaticLink(child)) child.remove();
    });
    // Re-append everything in the configured order.
    items.forEach(function (it) {
      if (it.href === '/services') {
        if (servicesWrap && list.contains(servicesWrap) === false) list.appendChild(servicesWrap);
        else if (servicesWrap) list.appendChild(servicesWrap);
        else if (servicesMobile) list.appendChild(servicesMobile);
        else appendPlain(list, it);
      } else {
        appendPlain(list, it);
      }
    });
    // Hide the Services dropdown/mobile submenu if Services was excluded.
    var servicesShown = items.some(function (it) { return it.href === '/services'; });
    if (!servicesShown) {
      if (servicesWrap) servicesWrap.remove();
      if (servicesMobile) servicesMobile.remove();
    }
  }

  function appendPlain(list, it) {
    var a = document.createElement('a');
    a.href = it.href;
    a.textContent = it.label;
    if ((here === it.href.replace(/\/$/, '') || (it.href === '/' && here === '/'))) a.classList.add('is-active');
    list.appendChild(a);
  }

  fetch('/api/pages', { cache: 'no-store' })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var items = (d && d.items) || [];
      if (!items.length) return;
      rebuild(document.querySelector('nav.nav__links'),        items);
      rebuild(document.querySelector('nav.nav__mobile__links'), items);
    })
    .catch(function () { /* silent — nav falls back to the baked-in HTML */ });
})();

// ---- Analytics beacon (fire-and-forget, sends one row per page view) ----
// Skips admin pages and anything triggered by a Vercel prerender / build.
(function () {
  try {
    if (/^\/admin(\/|$)/.test(window.location.pathname)) return;
    if (__SM_EDIT_MODE__) return;   // never count admin edit views

    var SESSION_KEY = 'sm_session_id';
    var HITS_KEY = 'sm_session_hits';

    var sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    var isFirst = !sessionStorage.getItem(HITS_KEY);
    sessionStorage.setItem(HITS_KEY, '1');

    var payload = JSON.stringify({
      path: window.location.pathname,
      referrer: document.referrer || '',
      session_id: sid,
      first_hit: isFirst,
    });

    // Prefer sendBeacon — survives page unload, doesn't delay navigation.
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/track', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      }).catch(function () {});
    }
  } catch (e) { /* never break a page over analytics */ }
})();

// ---- Lead attribution: capture UTM params + click IDs on landing, persist for session ----
// Runs on every page load. First-touch wins (existing values are preserved so we don't clobber
// the ad-referred campaign on a later organic pageview).
(function () {
  try {
    var STORAGE_KEY = 'sm_attribution';
    var TRACKED = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
    var stored = {};
    try { stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch (e) { stored = {}; }

    var params = new URLSearchParams(window.location.search || '');
    var changed = false;
    TRACKED.forEach(function (k) {
      if (!stored[k] && params.has(k)) {
        stored[k] = params.get(k);
        changed = true;
      }
    });

    if (!stored.referrer && document.referrer) {
      var sameHost = false;
      try { sameHost = new URL(document.referrer).host === window.location.host; } catch (e) {}
      if (!sameHost) { stored.referrer = document.referrer; changed = true; }
    }
    if (!stored.landing_page) {
      stored.landing_page = window.location.pathname + window.location.search;
      changed = true;
    }
    if (changed) {
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stored)); } catch (e) {}
    }
  } catch (e) { /* attribution is best-effort — never break a page over it */ }
})();

// ---- Booking forms (Resend via /api/booking) ----
(function () {
  var forms = document.querySelectorAll('form[data-booking-form]');
  if (!forms.length) return;

  forms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      if (!btn || btn.disabled) return;

      var originalLabel = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Sending…';

      // Collect form data
      var data = {};
      Array.from(form.elements).forEach(function (el) {
        if (!el.name) return;
        if (el.type === 'submit' || el.type === 'button') return;
        data[el.name] = el.value;
      });
      data.page = window.location.pathname || '';

      // Attach attribution from sessionStorage (captured on landing) so we can tag
      // Meta / Google / organic leads in the admin.
      try {
        var attr = JSON.parse(sessionStorage.getItem('sm_attribution') || '{}') || {};
        ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','referrer','landing_page'].forEach(function (k) {
          if (attr[k]) data[k] = attr[k];
        });
      } catch (e) { /* ignore — attribution is optional */ }

      fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data),
      })
        .then(function (r) {
          return r.text().then(function (raw) {
            var body;
            try { body = JSON.parse(raw); } catch (_) { body = { error: raw || ('HTTP ' + r.status) }; }
            return { ok: r.ok, status: r.status, body: body };
          });
        })
        .then(function (resp) {
          if (resp.ok && resp.body && resp.body.ok) {
            // Redirect to the thank-you page
            window.location.href = 'thank-you';
            return;
          }
          btn.disabled = false;
          btn.innerHTML = originalLabel;
          // Coerce whatever the server returned in `.error` into a clean string.
          var raw = resp.body && resp.body.error;
          var msg;
          if (typeof raw === 'string') msg = raw;
          else if (raw && typeof raw === 'object') msg = raw.message || raw.error || JSON.stringify(raw);
          if (!msg) msg = 'Something went wrong. Please try again or call us at (647) 915-0231.';
          showFormError(form, msg);
        })
        .catch(function () {
          btn.disabled = false;
          btn.innerHTML = originalLabel;
          showFormError(form, 'Network error. Please check your connection or call us at (647) 915-0231.');
        });
    });
  });

  function showFormError(form, msg) {
    var existing = form.querySelector('.form__error');
    if (existing) existing.remove();
    var box = document.createElement('div');
    box.className = 'form__error';
    box.textContent = msg;
    form.appendChild(box);
  }
})();

// ---- Review "Read more" toggle ----
(function () {
  document.querySelectorAll('.reflection__readmore').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var article = link.closest('.reflection');
      if (!article) return;
      var body = article.querySelector('.reflection__body');
      if (!body) return;
      var clamped = body.classList.toggle('is-clamped');
      link.setAttribute('aria-expanded', clamped ? 'false' : 'true');
      link.textContent = clamped ? 'Read more' : 'Show less';
    });
  });
})();

// ---- Number counter animation (stats on About page) ----
(function () {
  var counters = document.querySelectorAll('.stat__count[data-target]');
  if (!counters.length) return;
  var supportsIO = 'IntersectionObserver' in window;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function animate(el) {
    var target = parseInt(el.getAttribute('data-target'), 10) || 0;
    if (reduceMotion) { el.textContent = target; return; }
    var duration = 1500;
    var startTime = null;
    function tick(now) {
      if (startTime === null) startTime = now;
      var elapsed = now - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      el.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  if (!supportsIO) {
    counters.forEach(animate);
    return;
  }
  var ioCount = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting && !e.target.dataset.animated) {
        e.target.dataset.animated = '1';
        animate(e.target);
        ioCount.unobserve(e.target);
      }
    });
  }, { threshold: 0.4 });
  counters.forEach(function (c) { ioCount.observe(c); });
})();

// ---- Instagram reel video controls (play/pause + mute toggle + auto-hide play button) ----
(function () {
  document.querySelectorAll('.reel--video').forEach(function (reel) {
    var video = reel.querySelector('video');
    var playBtn = reel.querySelector('.reel__playbtn');
    var muteBtn = reel.querySelector('.reel__mutebtn');
    if (!video) return;

    function syncMuteUI() {
      if (!muteBtn) return;
      var icon = muteBtn.querySelector('.emo');
      if (icon) icon.textContent = video.muted ? '🔇' : '🔊';
      muteBtn.setAttribute('aria-label', video.muted ? 'Unmute video' : 'Mute video');
    }

    video.addEventListener('playing', function () { reel.classList.add('is-playing'); });
    video.addEventListener('pause',   function () { reel.classList.remove('is-playing'); });
    video.addEventListener('ended',   function () { reel.classList.remove('is-playing'); });

    if (playBtn) {
      playBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (video.paused) { video.play(); } else { video.pause(); }
      });
    }
    if (muteBtn) {
      muteBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        video.muted = !video.muted;
        if (!video.muted && video.paused) video.play();
        syncMuteUI();
      });
      syncMuteUI();
    }

    // If autoplay succeeds, mark playing right away
    if (!video.paused) reel.classList.add('is-playing');
  });
})();

// ---- Mobile menu toggle ----
(function () {
  var openBtn = document.getElementById('navToggle');
  var closeBtn = document.getElementById('navClose');
  var menu = document.getElementById('navMobile');
  if (!openBtn || !closeBtn || !menu) return;
  var open = function () {
    menu.classList.add('is-open');
    document.body.classList.add('nav-open');
    openBtn.setAttribute('aria-expanded', 'true');
  };
  var close = function () {
    menu.classList.remove('is-open');
    document.body.classList.remove('nav-open');
    openBtn.setAttribute('aria-expanded', 'false');
  };
  openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', close); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('is-open')) close();
  });
})();

(function () {
  var supportsIO = 'IntersectionObserver' in window;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- 1. Generic section-level reveal ----
  var sections = document.querySelectorAll('section, footer');
  if (!supportsIO || reduceMotion) {
    sections.forEach(function (s) { s.classList.add('is-shown'); });
    return;
  }
  var ioS = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('is-shown');
        ioS.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  sections.forEach(function (s) { ioS.observe(s); });

  // ---- 2. Subtle parallax on hero image ----
  var heroImg = document.querySelector('.hero__image img');
  if (heroImg && !reduceMotion) {
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          var y = window.scrollY;
          if (y < 800) {
            heroImg.style.transform = 'translateY(' + (y * 0.08) + 'px)';
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }
})();
