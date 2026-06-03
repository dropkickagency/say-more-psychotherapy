// Enable animation styles only when JS is available
document.documentElement.classList.add('js-animate');

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
            window.location.href = 'thank-you.html';
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
