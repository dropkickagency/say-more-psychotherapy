// Server-side HTML for user-authored dynamic pages.
//
// Two exports drive everything:
//   - renderPageHtml(page) — renders one page (used by /api/page)
//   - SECTION_LIBRARY       — metadata for the admin picker (categories,
//                             variants, labels, wireframes, defaults)
//
// The section renderer switch is small — each variant is a data-driven
// template that uses existing site utility classes (.section, .wrap,
// .eyebrow, .lead, .btn, .cta, .hair, .img-box, .service-card, etc.)
// so it inherits fonts, colours, and spacing without extra CSS.

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Sanitise user-supplied href attributes so nobody can smuggle
// `javascript:` / `data:` protocols through the sections API.
function safeHref(h, fallback) {
  var s = String(h == null ? "" : h).trim();
  if (!s) return esc(fallback || "#");
  if (/^javascript:/i.test(s) || /^data:/i.test(s) || /^vbscript:/i.test(s)) return esc(fallback || "#");
  return esc(s);
}

// -----------------------------------------------------------------
// 24 section templates — 8 categories × 3 variants
// -----------------------------------------------------------------

function heroCentered(c) {
  return `<section class="hero" style="min-height: 60vh; text-align: center;">
    <div class="wrap hero__inner" style="justify-content: center;">
      <div class="hero__text" style="text-align: center; max-width: 780px; margin: 0 auto;">
        ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
        <h1>${esc(c.title || "New page")}</h1>
        ${c.subtitle ? `<p class="lead">${esc(c.subtitle)}</p>` : ""}
        ${c.cta_label ? `<div class="hero__cta" style="justify-content: center;"><a class="btn btn--primary" href="${safeHref(c.cta_href, "/consultation")}">${esc(c.cta_label)}</a></div>` : ""}
      </div>
    </div>
  </section>`;
}
function heroSplit(c) {
  return `<section class="hero">
    <div class="wrap hero__inner" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2xl); align-items: center;">
      <div class="hero__text">
        ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
        <h1>${esc(c.title || "Say what you couldn't say.")}</h1>
        ${c.subtitle ? `<p class="lead">${esc(c.subtitle)}</p>` : ""}
        ${c.cta_label ? `<div class="hero__cta"><a class="btn btn--primary" href="${safeHref(c.cta_href, "/consultation")}">${esc(c.cta_label)}</a></div>` : ""}
      </div>
      <div class="img-box" style="aspect-ratio: 4/5; border-radius: 20px;">
        <img src="${safeHref(c.image, "/logo.jpg")}" alt="${esc(c.image_alt || "")}" loading="lazy" />
      </div>
    </div>
  </section>`;
}
function heroMinimal(c) {
  return `<section class="section" style="padding-top: var(--space-3xl); padding-bottom: var(--space-lg); text-align: center;">
    <div class="wrap" style="max-width: 720px;">
      ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
      <h1 style="margin-top: var(--space-md);">${esc(c.title || "A quiet page.")}</h1>
      <div class="hair" style="margin: var(--space-lg) auto 0;"></div>
    </div>
  </section>`;
}

function aboutTwoCol(c) {
  return `<section class="section">
    <div class="wrap" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2xl); align-items: center;">
      <div>
        ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
        ${c.title ? `<h2>${esc(c.title)}</h2>` : ""}
        ${c.body ? `<p class="lead" style="white-space: pre-wrap;">${esc(c.body)}</p>` : ""}
      </div>
      <div class="img-box" style="aspect-ratio: 4/5;">
        <img src="${safeHref(c.image, "/logo.jpg")}" alt="${esc(c.image_alt || "")}" loading="lazy" />
      </div>
    </div>
  </section>`;
}
function aboutFounder(c) {
  const creds = Array.isArray(c.credentials) ? c.credentials : (c.credentials ? String(c.credentials).split("\n").filter(Boolean) : []);
  return `<section class="section" style="background: var(--color-surface);">
    <div class="wrap" style="display: grid; grid-template-columns: 320px 1fr; gap: var(--space-2xl); align-items: start;">
      <div class="therapist__portrait" style="aspect-ratio: 4/5; border-radius: 20px; overflow: hidden;">
        <img src="${safeHref(c.image, "/logo.jpg")}" alt="${esc(c.image_alt || "")}" loading="lazy" />
      </div>
      <div>
        ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
        <h2>${esc(c.title || "About")}</h2>
        ${c.body ? `<p class="lead" style="white-space: pre-wrap;">${esc(c.body)}</p>` : ""}
        ${creds.length ? `<ul style="list-style: none; padding: 0; margin-top: var(--space-md); display: flex; flex-direction: column; gap: 6px;">
          ${creds.map(l => `<li style="color: var(--color-ink); font-size: 14px;"><span style="color: var(--color-brand); margin-right: 8px;">◆</span>${esc(l)}</li>`).join("")}
        </ul>` : ""}
      </div>
    </div>
  </section>`;
}
function aboutStats(c) {
  const stats = Array.isArray(c.stats) ? c.stats : [];
  // Stat value + label rendered as <p> (not <div>) so the click-to-edit
  // handler picks them up — TEXT_TAGS in edit-mode.js includes p/span/em
  // but not raw div.
  return `<section class="section" style="text-align: center;">
    <div class="wrap" style="max-width: 820px;">
      ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
      <h2>${esc(c.title || "About")}</h2>
      ${c.body ? `<p class="lead">${esc(c.body)}</p>` : ""}
      ${stats.length ? `<div style="display: grid; grid-template-columns: repeat(${Math.min(stats.length, 3)}, 1fr); gap: var(--space-lg); margin-top: var(--space-xl);">
        ${stats.map(s => `<div class="sm-stat">
          <p class="sm-stat__value" style="font-family: 'Cormorant Garamond', serif; font-size: 44px; color: var(--color-brand); font-weight: 500; margin: 0; line-height: 1;">${esc(s.value || "")}</p>
          <p class="sm-stat__label" style="font-size: 13px; color: var(--color-muted); margin: 4px 0 0;">${esc(s.label || "")}</p>
        </div>`).join("")}
      </div>` : ""}
    </div>
  </section>`;
}

function servicesGrid(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section" style="background: var(--color-surface);">
    <div class="wrap">
      <div style="text-align: center; margin-bottom: var(--space-xl);">
        ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
        ${c.title ? `<h2>${esc(c.title)}</h2>` : ""}
      </div>
      <div class="services__grid">
        ${items.map(it => `<article class="service-card">
          <div class="img-box"><img src="${safeHref(it.image, "/logo.jpg")}" alt="${esc(it.title || "")}" loading="lazy" /></div>
          <div class="service-card__body">
            <h3>${esc(it.title || "Service")}</h3>
            ${it.description ? `<p>${esc(it.description)}</p>` : ""}
            ${it.cta_label ? `<a href="${safeHref(it.cta_href, "/consultation")}" class="service-card__cta">${esc(it.cta_label)} <span class="emo emo--sm">→</span></a>` : ""}
          </div>
        </article>`).join("")}
      </div>
    </div>
  </section>`;
}
function servicesList(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section">
    <div class="wrap" style="max-width: 820px;">
      ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
      ${c.title ? `<h2>${esc(c.title)}</h2>` : ""}
      <div style="margin-top: var(--space-lg); display: flex; flex-direction: column; gap: 0; border-top: 1px solid var(--color-border);">
        ${items.map(it => `<div style="display: grid; grid-template-columns: 1fr auto; gap: var(--space-md); align-items: center; padding: var(--space-md) 0; border-bottom: 1px solid var(--color-border);">
          <div>
            <h3 style="margin: 0;">${esc(it.title || "Service")}</h3>
            ${it.description ? `<p style="margin: 4px 0 0; color: var(--color-muted);">${esc(it.description)}</p>` : ""}
          </div>
          ${it.cta_label ? `<a href="${safeHref(it.cta_href, "/consultation")}" class="btn btn--ghost btn--sm">${esc(it.cta_label)}</a>` : ""}
        </div>`).join("")}
      </div>
    </div>
  </section>`;
}
function servicesFeatures(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section" style="background: var(--color-surface);">
    <div class="wrap">
      <div style="text-align: center; margin-bottom: var(--space-xl);">
        ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
        ${c.title ? `<h2>${esc(c.title)}</h2>` : ""}
      </div>
      <div style="display: grid; grid-template-columns: repeat(${Math.min(items.length, 3)}, 1fr); gap: var(--space-lg);">
        ${items.map(it => `<div style="background: #fff; border: 1px solid var(--color-border); border-radius: 16px; padding: var(--space-lg);">
          <h3>${esc(it.title || "Feature")}</h3>
          ${Array.isArray(it.bullets) ? `<ul style="list-style: none; padding: 0; margin-top: var(--space-sm); display: flex; flex-direction: column; gap: 8px;">
            ${it.bullets.map(b => `<li style="color: var(--color-ink); font-size: 14.5px;"><span style="color: var(--color-brand); margin-right: 8px;">✓</span>${esc(b)}</li>`).join("")}
          </ul>` : ""}
        </div>`).join("")}
      </div>
    </div>
  </section>`;
}

function faqAccordion(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section">
    <div class="wrap" style="max-width: 780px;">
      <div style="text-align: center; margin-bottom: var(--space-xl);">
        ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
        ${c.title ? `<h2>${esc(c.title)}</h2>` : ""}
      </div>
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${items.map(it => `<details class="sm-faq" style="background: #fff; border: 1px solid var(--color-border); border-radius: 12px; padding: 18px 22px;">
          <summary class="sm-faq__q" style="cursor: pointer; font-family: 'Manrope', sans-serif; font-weight: 600; font-size: 15.5px; color: var(--color-ink); list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
            <span>${esc(it.q || "Question?")}</span><span style="color: var(--color-brand); font-size: 18px;">⌄</span>
          </summary>
          <p class="sm-faq__a" style="margin: 12px 0 0; color: var(--color-muted); font-size: 15px; line-height: 1.65; white-space: pre-wrap;">${esc(it.a || "")}</p>
        </details>`).join("")}
      </div>
    </div>
  </section>`;
}
function faqTwoCol(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section" style="background: var(--color-surface);">
    <div class="wrap">
      ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-xl) var(--space-2xl);">
        ${items.map(it => `<div>
          <h3 style="font-size: 18px; margin: 0 0 8px;">${esc(it.q || "Question?")}</h3>
          <p style="margin: 0; color: var(--color-muted); font-size: 14.5px; line-height: 1.6; white-space: pre-wrap;">${esc(it.a || "")}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;
}
function faqCards(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section">
    <div class="wrap">
      ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-md);">
        ${items.map(it => `<div style="background: #fff; border: 1px solid var(--color-border); border-radius: 14px; padding: var(--space-md);">
          <div style="font-family: 'Cormorant Garamond', serif; color: var(--color-brand); font-size: 24px; margin-bottom: 6px;">?</div>
          <h3 style="font-size: 15px; margin: 0 0 6px;">${esc(it.q || "")}</h3>
          <p style="margin: 0; color: var(--color-muted); font-size: 13.5px; line-height: 1.55;">${esc(it.a || "")}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;
}

function ctaDark(c) {
  return `<section class="cta" style="background-image: url('${safeHref(c.image, "/cta%202.png")}');">
    <div class="wrap cta__inner" style="text-align: center; position: relative; z-index: 1;">
      ${c.eyebrow ? `<span class="eyebrow" style="color: rgba(255,255,255,0.85);">${esc(c.eyebrow)}</span>` : ""}
      <h2 style="color: #fff;">${esc(c.title || "Take the first step")}</h2>
      ${c.subtitle ? `<p class="lead" style="color: rgba(255,255,255,0.9);">${esc(c.subtitle)}</p>` : ""}
      <div style="margin-top: var(--space-lg);"><a class="btn btn--primary" href="${safeHref(c.cta_href, "/consultation")}">${esc(c.cta_label || "Book a free consultation")}</a></div>
    </div>
  </section>`;
}
function ctaSplit(c) {
  return `<section class="section" style="background: var(--color-brand-light);">
    <div class="wrap" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2xl); align-items: center;">
      <div>
        ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
        <h2>${esc(c.title || "Ready to start?")}</h2>
        ${c.subtitle ? `<p class="lead" style="color: var(--color-muted);">${esc(c.subtitle)}</p>` : ""}
      </div>
      <div style="background: #fff; border-radius: 16px; padding: var(--space-lg); border: 1px solid var(--color-border);">
        <div style="font-family: 'Manrope', sans-serif; font-weight: 600; margin-bottom: var(--space-sm);">${esc(c.form_title || "Book a free consultation")}</div>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: var(--space-md);">
          <input type="text" placeholder="Your name" style="padding: 10px 14px; border-radius: 8px; border: 1px solid var(--color-border); font-family: inherit;" disabled />
          <input type="email" placeholder="Email address" style="padding: 10px 14px; border-radius: 8px; border: 1px solid var(--color-border); font-family: inherit;" disabled />
        </div>
        <a class="btn btn--primary" href="${safeHref(c.cta_href, "/consultation")}" style="width: 100%; text-align: center;">${esc(c.cta_label || "Get started")}</a>
      </div>
    </div>
  </section>`;
}
function ctaPill(c) {
  return `<section class="section" style="padding: var(--space-xl) 0;">
    <div class="wrap" style="max-width: 720px;">
      <div style="background: #fff; border: 1px solid var(--color-border); border-radius: 999px; padding: 12px 20px; display: flex; align-items: center; justify-content: space-between; gap: var(--space-md); box-shadow: 0 4px 24px rgba(0,0,0,0.04);">
        <div style="font-family: 'Manrope', sans-serif; font-weight: 600; color: var(--color-ink);">${esc(c.title || "Have questions? Let's talk.")}</div>
        <a class="btn btn--primary btn--sm" href="${safeHref(c.cta_href, "/consultation")}">${esc(c.cta_label || "Book a call")}</a>
      </div>
    </div>
  </section>`;
}

function stepsVertical(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section">
    <div class="wrap" style="max-width: 780px;">
      <div style="text-align: center; margin-bottom: var(--space-xl);">
        ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
        ${c.title ? `<h2>${esc(c.title)}</h2>` : ""}
      </div>
      <ol style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-lg);">
        ${items.map((it, i) => `<li style="display: grid; grid-template-columns: 56px 1fr; gap: var(--space-md); align-items: start;">
          <div style="width: 44px; height: 44px; border-radius: 999px; background: var(--color-brand); color: #fff; display: flex; align-items: center; justify-content: center; font-family: 'Cormorant Garamond', serif; font-size: 20px;">${i + 1}</div>
          <div>
            <h3 style="margin: 0 0 4px;">${esc(it.title || "Step")}</h3>
            <p style="margin: 0; color: var(--color-muted); white-space: pre-wrap;">${esc(it.description || "")}</p>
          </div>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}
function stepsHorizontal(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section" style="background: var(--color-surface);">
    <div class="wrap">
      <div style="text-align: center; margin-bottom: var(--space-xl);">
        ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
        ${c.title ? `<h2>${esc(c.title)}</h2>` : ""}
      </div>
      <div style="display: grid; grid-template-columns: repeat(${Math.min(items.length, 3)}, 1fr); gap: var(--space-lg);">
        ${items.map((it, i) => `<div style="text-align: center; padding: var(--space-md);">
          <div style="font-family: 'Cormorant Garamond', serif; font-size: 48px; color: var(--color-brand); line-height: 1;">${i + 1}</div>
          <h3 style="margin: var(--space-sm) 0 4px;">${esc(it.title || "")}</h3>
          <p style="margin: 0; color: var(--color-muted); font-size: 14.5px;">${esc(it.description || "")}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;
}
function stepsTimeline(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section">
    <div class="wrap" style="max-width: 900px;">
      ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
      <div style="position: relative; display: grid; grid-template-columns: repeat(${items.length}, 1fr); gap: var(--space-md);">
        <div style="position: absolute; top: 14px; left: 6%; right: 6%; height: 2px; background: var(--color-border); z-index: 0;"></div>
        ${items.map((it, i) => `<div style="text-align: center; position: relative; z-index: 1;">
          <div style="width: 28px; height: 28px; border-radius: 999px; background: var(--color-brand); border: 3px solid #fff; margin: 0 auto; box-shadow: 0 0 0 1px var(--color-border);"></div>
          <div style="margin-top: 12px; font-family: 'Manrope', sans-serif; font-weight: 600; font-size: 14px; color: var(--color-ink);">${esc(it.title || "Step " + (i + 1))}</div>
          <div style="margin-top: 4px; color: var(--color-muted); font-size: 13px;">${esc(it.description || "")}</div>
        </div>`).join("")}
      </div>
    </div>
  </section>`;
}

function testimonialQuote(c) {
  const starColor = c.star_color || "var(--color-brand)";
  return `<section class="section" style="text-align: center;">
    <div class="wrap" style="max-width: 760px;">
      <div style="font-family: 'Cormorant Garamond', serif; font-size: 80px; color: ${esc(starColor)}; line-height: 1;">"</div>
      <p style="font-family: 'Cormorant Garamond', serif; font-size: 26px; line-height: 1.5; color: var(--color-ink); font-style: italic; margin: 0;">${esc(c.quote || "Their care changed everything for me.")}</p>
      <p class="sm-testimonial-author" style="margin: var(--space-md) 0 0; font-family: 'Manrope', sans-serif; font-weight: 600; color: var(--color-ink);">${esc(c.author || "Anonymous")}</p>
      ${c.role ? `<p class="sm-testimonial-role" style="margin: 2px 0 0; color: var(--color-muted); font-size: 13.5px;">${esc(c.role)}</p>` : ""}
    </div>
  </section>`;
}
function testimonialCards(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  const starColor = c.star_color || "var(--color-brand)";
  return `<section class="section sm-testimonial-section" data-star-color="${esc(c.star_color || "")}" style="background: var(--color-surface);">
    <div class="wrap">
      ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-lg);">
        ${items.map(it => `<div style="background: #fff; padding: var(--space-lg); border-radius: 16px; border: 1px solid var(--color-border);">
          <p class="sm-testimonial-stars" style="color: ${esc(starColor)}; margin: 0 0 6px; font-size: 16px; letter-spacing: 2px;">${"★".repeat(Math.max(1, Math.min(5, Number(it.rating) || 5)))}</p>
          <p style="font-family: 'Cormorant Garamond', serif; font-size: 18px; line-height: 1.55; font-style: italic; margin: 0;">"${esc(it.quote || "")}"</p>
          <p class="sm-testimonial-author" style="margin: var(--space-sm) 0 0; font-family: 'Manrope', sans-serif; font-weight: 600; font-size: 14px;">${esc(it.author || "Anonymous")}</p>
          ${it.role ? `<p class="sm-testimonial-role" style="margin: 2px 0 0; color: var(--color-muted); font-size: 12.5px;">${esc(it.role)}</p>` : ""}
        </div>`).join("")}
      </div>
    </div>
  </section>`;
}
function testimonialRow(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  const accentColor = c.star_color || "var(--color-brand)";
  return `<section class="section sm-testimonial-section" data-star-color="${esc(c.star_color || "")}">
    <div class="wrap">
      ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-md);">
        ${items.map(it => `<div style="padding: var(--space-md); border-left: 3px solid ${esc(accentColor)};">
          <p style="font-family: 'Cormorant Garamond', serif; font-size: 17px; font-style: italic; line-height: 1.55; margin: 0;">"${esc(it.quote || "")}"</p>
          <p class="sm-testimonial-author" style="margin: 10px 0 0; font-family: 'Manrope', sans-serif; font-weight: 600; font-size: 13px;">— ${esc(it.author || "Anonymous")}</p>
        </div>`).join("")}
      </div>
    </div>
  </section>`;
}

function galleryGrid(c) {
  const images = Array.isArray(c.images) ? c.images : [];
  return `<section class="section">
    <div class="wrap">
      ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-sm);">
        ${images.map(im => `<div class="img-box" style="aspect-ratio: 1/1; border-radius: 12px; overflow: hidden;"><img src="${safeHref(im.src, "/logo.jpg")}" alt="${esc(im.alt || "")}" loading="lazy" /></div>`).join("")}
      </div>
    </div>
  </section>`;
}
function galleryMasonry(c) {
  const images = Array.isArray(c.images) ? c.images : [];
  return `<section class="section" style="background: var(--color-surface);">
    <div class="wrap">
      ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
      <div style="columns: 3; column-gap: var(--space-sm);">
        ${images.map(im => `<div class="img-box" style="aspect-ratio: ${im.tall ? "3/4" : "1/1"}; border-radius: 12px; overflow: hidden; margin-bottom: var(--space-sm); break-inside: avoid;"><img src="${safeHref(im.src, "/logo.jpg")}" alt="${esc(im.alt || "")}" loading="lazy" /></div>`).join("")}
      </div>
    </div>
  </section>`;
}
function galleryBand(c) {
  const images = Array.isArray(c.images) ? c.images : [];
  return `<section class="section" style="padding: var(--space-md) 0;">
    <div style="display: grid; grid-template-columns: repeat(${images.length || 4}, 1fr); gap: 4px;">
      ${images.map(im => `<div class="img-box" style="aspect-ratio: 3/2; border-radius: 0; overflow: hidden;"><img src="${safeHref(im.src, "/logo.jpg")}" alt="${esc(im.alt || "")}" loading="lazy" /></div>`).join("")}
    </div>
  </section>`;
}

// ---- Additional variants (Phase 4) ----------------------------------

function heroDarkImage(c) {
  return `<section class="cta" style="min-height: 62vh; background-image: url('${safeHref(c.image, "/cta%202.png")}');">
    <div class="wrap cta__inner" style="text-align: center; position: relative; z-index: 1;">
      ${c.eyebrow ? `<span class="eyebrow" style="color: rgba(255,255,255,0.85);">${esc(c.eyebrow)}</span>` : ""}
      <h1 style="color: #fff;">${esc(c.title || "Say what you couldn't say.")}</h1>
      ${c.subtitle ? `<p class="lead" style="color: rgba(255,255,255,0.9);">${esc(c.subtitle)}</p>` : ""}
      ${c.cta_label ? `<div style="margin-top: var(--space-lg);"><a class="btn btn--primary" href="${safeHref(c.cta_href, "/consultation")}">${esc(c.cta_label)}</a></div>` : ""}
    </div>
  </section>`;
}
function heroDualCta(c) {
  return `<section class="hero" style="min-height: 60vh; text-align: center;">
    <div class="wrap hero__inner" style="justify-content: center;">
      <div class="hero__text" style="text-align: center; max-width: 780px; margin: 0 auto;">
        ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
        <h1>${esc(c.title || "Two ways to begin.")}</h1>
        ${c.subtitle ? `<p class="lead">${esc(c.subtitle)}</p>` : ""}
        <div class="hero__cta" style="justify-content: center; gap: var(--space-sm);">
          <a class="btn btn--primary" href="${safeHref(c.cta_href, "/consultation")}">${esc(c.cta_label || "Book a session")}</a>
          <a class="btn btn--ghost"   href="${safeHref(c.cta2_href, "/about")}">${esc(c.cta2_label || "Learn more")}</a>
        </div>
      </div>
    </div>
  </section>`;
}
function heroBadge(c) {
  return `<section class="section" style="padding-top: var(--space-3xl); text-align: center;">
    <div class="wrap" style="max-width: 780px;">
      <span style="display: inline-block; padding: 6px 16px; background: var(--color-brand); color: #fff; border-radius: 999px; font-family: 'Manrope', sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;">${esc(c.badge || "New")}</span>
      <h1 style="margin-top: var(--space-md);">${esc(c.title || "An announcement.")}</h1>
      ${c.subtitle ? `<p class="lead">${esc(c.subtitle)}</p>` : ""}
    </div>
  </section>`;
}

function aboutTimeline(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section"><div class="wrap" style="max-width: 780px;">
    ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
    <ol style="list-style: none; padding: 0; border-left: 2px solid var(--color-brand); margin: 0;">
      ${items.map(it => `<li style="position: relative; padding: 0 0 var(--space-lg) var(--space-lg);">
        <span style="position: absolute; left: -9px; top: 4px; width: 16px; height: 16px; border-radius: 999px; background: var(--color-brand); border: 3px solid #fff; box-shadow: 0 0 0 1px var(--color-brand);"></span>
        <p style="font-family: 'Cormorant Garamond', serif; font-size: 22px; color: var(--color-brand); margin: 0;">${esc(it.year || "")}</p>
        <h3 style="margin: 4px 0 6px;">${esc(it.title || "")}</h3>
        <p style="margin: 0; color: var(--color-muted);">${esc(it.description || "")}</p>
      </li>`).join("")}
    </ol>
  </div></section>`;
}
function aboutValues(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section" style="background: var(--color-surface);"><div class="wrap">
    ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
    <div style="display: grid; grid-template-columns: repeat(${Math.min(items.length, 3)}, 1fr); gap: var(--space-lg);">
      ${items.map((it, i) => `<div style="text-align: center;">
        <p style="font-family: 'Cormorant Garamond', serif; font-size: 56px; color: var(--color-brand); line-height: 1; font-style: italic; margin: 0;">${String(i + 1).padStart(2, "0")}</p>
        <h3 style="margin-top: var(--space-sm);">${esc(it.title || "Value")}</h3>
        <p style="color: var(--color-muted);">${esc(it.description || "")}</p>
      </div>`).join("")}
    </div>
  </div></section>`;
}
function aboutList(c) {
  const bullets = Array.isArray(c.bullets) ? c.bullets : [];
  return `<section class="section"><div class="wrap" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2xl); align-items: center;">
    <div>
      ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
      ${c.title ? `<h2>${esc(c.title)}</h2>` : ""}
      ${c.body ? `<p class="lead">${esc(c.body)}</p>` : ""}
      ${bullets.length ? `<ul style="list-style: none; padding: 0; margin-top: var(--space-md); display: flex; flex-direction: column; gap: 10px;">
        ${bullets.map(b => `<li style="display: flex; gap: 12px; align-items: flex-start; color: var(--color-ink);"><span style="color: var(--color-brand); font-weight: 700; flex: none;">✓</span><span>${esc(b)}</span></li>`).join("")}
      </ul>` : ""}
    </div>
    <div class="img-box" style="aspect-ratio: 4/5;"><img src="${safeHref(c.image, "/logo.jpg")}" alt="${esc(c.image_alt || "")}" loading="lazy" /></div>
  </div></section>`;
}

function servicesIcons(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section" style="text-align: center;"><div class="wrap">
    ${c.title ? `<h2>${esc(c.title)}</h2>` : ""}
    <div style="display: grid; grid-template-columns: repeat(${Math.min(items.length, 3)}, 1fr); gap: var(--space-lg); margin-top: var(--space-xl);">
      ${items.map(it => `<div>
        <div style="width: 64px; height: 64px; border-radius: 999px; background: var(--color-surface); color: var(--color-brand); display: flex; align-items: center; justify-content: center; font-size: 26px; margin: 0 auto var(--space-sm);">${esc(it.icon || "◆")}</div>
        <h3>${esc(it.title || "Service")}</h3>
        <p style="color: var(--color-muted);">${esc(it.description || "")}</p>
      </div>`).join("")}
    </div>
  </div></section>`;
}
function servicesPricing(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section" style="background: var(--color-surface);"><div class="wrap">
    ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
    <div style="display: grid; grid-template-columns: repeat(${Math.min(items.length, 3)}, 1fr); gap: var(--space-md);">
      ${items.map(it => `<div style="background: #fff; padding: var(--space-lg); border-radius: 16px; border: 1px solid var(--color-border); ${it.featured ? "outline: 2px solid var(--color-brand); outline-offset: -2px;" : ""}">
        <h3>${esc(it.title || "Tier")}</h3>
        <p style="font-family: 'Cormorant Garamond', serif; font-size: 44px; color: var(--color-brand); line-height: 1; margin: var(--space-sm) 0 4px;">${esc(it.price || "$150")}</p>
        <p style="color: var(--color-muted); font-size: 13px; margin: 0;">${esc(it.period || "per session")}</p>
        <ul style="list-style: none; padding: 0; margin: var(--space-md) 0; display: flex; flex-direction: column; gap: 6px;">
          ${(it.features || []).map(f => `<li style="display: flex; gap: 8px; align-items: flex-start;"><span style="color: var(--color-brand); flex: none;">✓</span><span>${esc(f)}</span></li>`).join("")}
        </ul>
        <a class="btn btn--primary" href="${safeHref(it.cta_href, "/consultation")}" style="width: 100%; text-align: center;">${esc(it.cta_label || "Choose")}</a>
      </div>`).join("")}
    </div>
  </div></section>`;
}
function servicesSplitList(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section"><div class="wrap">
    ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-lg);">
      ${items.map(it => `<div style="padding: var(--space-md) var(--space-md) var(--space-md) var(--space-lg); border-left: 3px solid var(--color-brand);">
        <h3 style="margin-top: 0;">${esc(it.title || "Service")}</h3>
        ${it.description ? `<p style="color: var(--color-muted); margin: 0 0 var(--space-sm);">${esc(it.description)}</p>` : ""}
        ${it.cta_label ? `<a href="${safeHref(it.cta_href, "/consultation")}" style="color: var(--color-brand); font-weight: 600;">${esc(it.cta_label)} →</a>` : ""}
      </div>`).join("")}
    </div>
  </div></section>`;
}

function faqPlain(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section"><div class="wrap" style="max-width: 720px;">
    ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
    <div style="display: flex; flex-direction: column; gap: var(--space-md);">
      ${items.map(it => `<div style="padding-bottom: var(--space-md); border-bottom: 1px solid var(--color-border);">
        <h3 style="margin: 0 0 6px;">${esc(it.q || "")}</h3>
        <p style="margin: 0; color: var(--color-muted); white-space: pre-wrap;">${esc(it.a || "")}</p>
      </div>`).join("")}
    </div>
  </div></section>`;
}
function faqNumbered(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section" style="background: var(--color-surface);"><div class="wrap" style="max-width: 780px;">
    ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
    <ol style="list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-md);">
      ${items.map((it, i) => `<li style="display: grid; grid-template-columns: 44px 1fr; gap: var(--space-md); background: #fff; padding: var(--space-md) var(--space-lg); border-radius: 12px; border: 1px solid var(--color-border);">
        <span style="font-family: 'Cormorant Garamond', serif; font-size: 32px; color: var(--color-brand); line-height: 1;">${String(i + 1).padStart(2, "0")}</span>
        <div><h3 style="margin: 0 0 4px;">${esc(it.q || "")}</h3><p style="margin: 0; color: var(--color-muted); white-space: pre-wrap;">${esc(it.a || "")}</p></div>
      </li>`).join("")}
    </ol>
  </div></section>`;
}
function faqContact(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section"><div class="wrap">
    ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
    <div style="display: grid; grid-template-columns: 1.4fr 1fr; gap: var(--space-2xl);">
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${items.map(it => `<details style="background: #fff; border: 1px solid var(--color-border); border-radius: 12px; padding: 14px 18px;">
          <summary style="cursor: pointer; font-family: 'Manrope', sans-serif; font-weight: 600; font-size: 15px; list-style: none;">${esc(it.q || "")}</summary>
          <p style="margin: 10px 0 0; color: var(--color-muted); font-size: 14.5px; white-space: pre-wrap;">${esc(it.a || "")}</p>
        </details>`).join("")}
      </div>
      <div style="background: var(--color-surface); padding: var(--space-lg); border-radius: 16px; align-self: start;">
        <h3 style="margin-top: 0;">${esc(c.cta_title || "Still have questions?")}</h3>
        <p style="color: var(--color-muted);">${esc(c.cta_body || "Book a free 15-minute consultation and we'll answer them.")}</p>
        <a class="btn btn--primary" href="${safeHref(c.cta_href, "/consultation")}" style="width: 100%; text-align: center; margin-top: var(--space-sm);">${esc(c.cta_label || "Book a call")}</a>
      </div>
    </div>
  </div></section>`;
}

function ctaNewsletter(c) {
  return `<section class="section" style="background: var(--color-surface); text-align: center;"><div class="wrap" style="max-width: 620px;">
    ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
    <h2>${esc(c.title || "Stay quietly in touch")}</h2>
    ${c.subtitle ? `<p class="lead">${esc(c.subtitle)}</p>` : ""}
    <form onsubmit="event.preventDefault(); this.querySelector('button').textContent='Thanks!';" style="display: flex; gap: 8px; margin-top: var(--space-lg); max-width: 460px; margin-left: auto; margin-right: auto;">
      <input type="email" required placeholder="${esc(c.placeholder || "your email")}" style="flex: 1; padding: 12px 16px; border-radius: 999px; border: 1px solid var(--color-border-strong); font-family: inherit;" />
      <button type="submit" class="btn btn--primary">${esc(c.cta_label || "Subscribe")}</button>
    </form>
  </div></section>`;
}
function ctaImageSide(c) {
  return `<section class="section" style="background: var(--color-brand-light);"><div class="wrap" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2xl); align-items: center;">
    <div class="img-box" style="aspect-ratio: 4/3; border-radius: 16px;"><img src="${safeHref(c.image, "/logo.jpg")}" alt="${esc(c.image_alt || "")}" loading="lazy" /></div>
    <div>
      ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
      <h2>${esc(c.title || "Let's start with a conversation")}</h2>
      ${c.subtitle ? `<p class="lead" style="color: var(--color-muted);">${esc(c.subtitle)}</p>` : ""}
      <div style="margin-top: var(--space-md);"><a class="btn btn--primary" href="${safeHref(c.cta_href, "/consultation")}">${esc(c.cta_label || "Book a free consultation")}</a></div>
    </div>
  </div></section>`;
}
function ctaTwoButtons(c) {
  return `<section class="section" style="text-align: center;"><div class="wrap" style="max-width: 720px;">
    ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
    <h2>${esc(c.title || "How can we help?")}</h2>
    ${c.subtitle ? `<p class="lead">${esc(c.subtitle)}</p>` : ""}
    <div style="display: flex; justify-content: center; gap: var(--space-sm); margin-top: var(--space-lg); flex-wrap: wrap;">
      <a class="btn btn--primary" href="${safeHref(c.cta_href, "/consultation")}">${esc(c.cta_label || "Book a session")}</a>
      <a class="btn btn--ghost"   href="${safeHref(c.cta2_href, "/about")}">${esc(c.cta2_label || "Learn more about us")}</a>
    </div>
  </div></section>`;
}

function stepsCards(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section" style="background: var(--color-surface);"><div class="wrap">
    ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
    <div style="display: grid; grid-template-columns: repeat(${Math.min(items.length, 4)}, 1fr); gap: var(--space-md);">
      ${items.map((it, i) => `<div style="background: #fff; padding: var(--space-lg); border-radius: 16px; border: 1px solid var(--color-border); text-align: left;">
        <p style="font-family: 'Cormorant Garamond', serif; font-size: 56px; color: var(--color-brand); line-height: 1; margin: 0;">${String(i + 1).padStart(2, "0")}</p>
        <h3 style="margin: var(--space-sm) 0 6px;">${esc(it.title || "Step")}</h3>
        <p style="color: var(--color-muted); margin: 0;">${esc(it.description || "")}</p>
      </div>`).join("")}
    </div>
  </div></section>`;
}
function stepsIconRow(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section" style="text-align: center;"><div class="wrap">
    ${c.title ? `<h2 style="margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
    <div style="display: grid; grid-template-columns: repeat(${Math.min(items.length, 3)}, 1fr); gap: var(--space-lg);">
      ${items.map(it => `<div>
        <div style="width: 64px; height: 64px; border-radius: 999px; background: var(--color-brand); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 26px; margin: 0 auto var(--space-sm);">${esc(it.icon || "◆")}</div>
        <h3>${esc(it.title || "Step")}</h3>
        <p style="color: var(--color-muted);">${esc(it.description || "")}</p>
      </div>`).join("")}
    </div>
  </div></section>`;
}
function stepsTwoCol(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section"><div class="wrap" style="max-width: 900px;">
    ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-lg) var(--space-2xl);">
      ${items.map((it, i) => `<div style="display: grid; grid-template-columns: 44px 1fr; gap: var(--space-sm); align-items: start;">
        <div style="width: 36px; height: 36px; border-radius: 999px; background: var(--color-brand); color: #fff; display: flex; align-items: center; justify-content: center; font-family: 'Cormorant Garamond', serif; font-size: 18px;">${i + 1}</div>
        <div><h3 style="margin: 0 0 4px;">${esc(it.title || "")}</h3><p style="margin: 0; color: var(--color-muted);">${esc(it.description || "")}</p></div>
      </div>`).join("")}
    </div>
  </div></section>`;
}

function testimonialAvatars(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  const starColor = c.star_color || "var(--color-brand)";
  return `<section class="section sm-testimonial-section" data-star-color="${esc(c.star_color || "")}"><div class="wrap">
    ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-lg);">
      ${items.map(it => `<div style="background: #fff; padding: var(--space-lg); border-radius: 16px; border: 1px solid var(--color-border); text-align: center;">
        <div style="width: 56px; height: 56px; border-radius: 999px; background: var(--color-surface); overflow: hidden; margin: 0 auto var(--space-sm);"><img src="${safeHref(it.avatar, "/logo.jpg")}" alt="${esc(it.author || "")}" style="width:100%;height:100%;object-fit:cover;" /></div>
        <p class="sm-testimonial-stars" style="color: ${esc(starColor)}; margin: 0 0 6px; font-size: 14px; letter-spacing: 2px;">${"★".repeat(Math.max(1, Math.min(5, Number(it.rating) || 5)))}</p>
        <p style="font-family: 'Cormorant Garamond', serif; font-size: 17px; font-style: italic; margin: 0;">"${esc(it.quote || "")}"</p>
        <p class="sm-testimonial-author" style="margin: var(--space-sm) 0 0; font-weight: 600; font-size: 13.5px;">${esc(it.author || "Anonymous")}</p>
        ${it.role ? `<p class="sm-testimonial-role" style="margin: 0; color: var(--color-muted); font-size: 12.5px;">${esc(it.role)}</p>` : ""}
      </div>`).join("")}
    </div>
  </div></section>`;
}
function testimonialWall(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section sm-testimonial-section" style="background: var(--color-surface);"><div class="wrap">
    ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
    <div style="columns: 3; column-gap: var(--space-md);">
      ${items.map(it => `<div style="background: #fff; padding: var(--space-md); border-radius: 12px; margin-bottom: var(--space-md); break-inside: avoid; border: 1px solid var(--color-border);">
        <p style="font-family: 'Cormorant Garamond', serif; font-size: 16px; font-style: italic; margin: 0;">"${esc(it.quote || "")}"</p>
        <p class="sm-testimonial-author" style="margin: var(--space-sm) 0 0; font-weight: 600; font-size: 12.5px;">— ${esc(it.author || "Anonymous")}</p>
      </div>`).join("")}
    </div>
  </div></section>`;
}
function testimonialDark(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  const starColor = c.star_color || "#D4A64A";
  return `<section class="section sm-testimonial-section" data-star-color="${esc(c.star_color || "")}" style="background: var(--color-espresso, #2a1f14); color: rgba(255,255,255,0.9);"><div class="wrap">
    ${c.title ? `<h2 style="text-align: center; color: #fff; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-lg);">
      ${items.map(it => `<div>
        <p class="sm-testimonial-stars" style="color: ${esc(starColor)}; margin: 0 0 6px; font-size: 14px; letter-spacing: 2px;">${"★".repeat(Math.max(1, Math.min(5, Number(it.rating) || 5)))}</p>
        <p style="font-family: 'Cormorant Garamond', serif; font-size: 18px; font-style: italic; color: #fff; margin: 0;">"${esc(it.quote || "")}"</p>
        <p class="sm-testimonial-author" style="margin: var(--space-sm) 0 0; font-weight: 600; color: rgba(255,255,255,0.85);">${esc(it.author || "Anonymous")}</p>
      </div>`).join("")}
    </div>
  </div></section>`;
}

function galleryGrid4(c) {
  const images = Array.isArray(c.images) ? c.images : [];
  return `<section class="section"><div class="wrap">
    ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-sm);">
      ${images.map(im => `<div class="img-box" style="aspect-ratio: 1/1; border-radius: 10px; overflow: hidden;"><img src="${safeHref(im.src, "/logo.jpg")}" alt="${esc(im.alt || "")}" loading="lazy" /></div>`).join("")}
    </div>
  </div></section>`;
}
function galleryMosaic(c) {
  const images = Array.isArray(c.images) ? c.images : [];
  const [hero, ...rest] = images;
  return `<section class="section" style="background: var(--color-surface);"><div class="wrap">
    ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
    <div style="display: grid; grid-template-columns: 2fr 1fr; grid-template-rows: 1fr 1fr; gap: var(--space-sm); min-height: 480px;">
      ${hero ? `<div class="img-box" style="grid-row: 1 / span 2; border-radius: 12px; overflow: hidden;"><img src="${safeHref(hero.src, "/logo.jpg")}" alt="${esc(hero.alt || "")}" loading="lazy" /></div>` : ""}
      ${rest.slice(0, 4).map(im => `<div class="img-box" style="border-radius: 12px; overflow: hidden;"><img src="${safeHref(im.src, "/logo.jpg")}" alt="${esc(im.alt || "")}" loading="lazy" /></div>`).join("")}
    </div>
  </div></section>`;
}
function galleryStrip(c) {
  const images = Array.isArray(c.images) ? c.images : [];
  return `<section class="section" style="padding: var(--space-md) 0;"><div style="display: flex; gap: 2px; overflow-x: auto; scroll-snap-type: x mandatory;">
    ${images.map(im => `<div class="img-box" style="flex: 0 0 260px; aspect-ratio: 4/3; border-radius: 0; overflow: hidden; scroll-snap-align: start;"><img src="${safeHref(im.src, "/logo.jpg")}" alt="${esc(im.alt || "")}" loading="lazy" /></div>`).join("")}
  </div></section>`;
}

// ---- Form sections (POST to /api/booking, sends via Resend) ---------
// script.js auto-wires any `<form data-booking-form>` to fetch(),
// injects attribution fields, and disables the submit button while
// in flight — so these forms need no per-form JS.

function formContact(c) {
  return `<section class="section" style="background: var(--color-surface);"><div class="wrap" style="max-width: 640px;">
    <div style="text-align: center; margin-bottom: var(--space-lg);">
      ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
      <h2>${esc(c.title || "Send us a message")}</h2>
      ${c.description ? `<p class="lead" style="color: var(--color-muted);">${esc(c.description)}</p>` : ""}
    </div>
    <form data-booking-form data-form-name="${esc(c.form_name || "contact")}" style="background: #fff; padding: var(--space-lg); border-radius: 16px; border: 1px solid var(--color-border); display: flex; flex-direction: column; gap: var(--space-sm);">
      <div class="form__honeypot" style="position: absolute; left: -9999px; height: 0; width: 0; overflow: hidden;"><label>Leave this empty <input name="website" tabindex="-1" autocomplete="off" /></label></div>
      <div class="form__field">
        <label for="fc_name"><span>${esc(c.label_name || "Your name")}</span></label>
        <input id="fc_name" name="name" type="text" required autocomplete="name" />
      </div>
      <div class="form__field">
        <label for="fc_email"><span>${esc(c.label_email || "Email")}</span></label>
        <input id="fc_email" name="email" type="email" required autocomplete="email" />
      </div>
      <div class="form__field">
        <label for="fc_note"><span>${esc(c.label_message || "Message")}</span></label>
        <textarea id="fc_note" name="note" rows="5" required></textarea>
      </div>
      <button type="submit" class="btn btn--primary" style="margin-top: 6px;">${esc(c.cta_label || "Send message")}</button>
      <p class="form__thanks" style="display: none; margin: 8px 0 0; color: var(--color-brand-dark); font-weight: 600;">${esc(c.thanks_message || "Thank you — we'll be in touch shortly.")}</p>
    </form>
  </div></section>`;
}

function formBooking(c) {
  return `<section class="section"><div class="wrap" style="max-width: 720px;">
    <div style="text-align: center; margin-bottom: var(--space-lg);">
      ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
      <h2>${esc(c.title || "Book a free consultation")}</h2>
      ${c.description ? `<p class="lead" style="color: var(--color-muted);">${esc(c.description)}</p>` : ""}
    </div>
    <form data-booking-form data-form-name="${esc(c.form_name || "booking")}" style="background: #fff; padding: var(--space-lg); border-radius: 16px; border: 1px solid var(--color-border); display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm);">
      <div class="form__honeypot" style="position: absolute; left: -9999px; height: 0; width: 0; overflow: hidden;"><label>Leave this empty <input name="website" tabindex="-1" autocomplete="off" /></label></div>
      <div class="form__field">
        <label for="fb_name"><span>${esc(c.label_name || "Your name")}</span></label>
        <input id="fb_name" name="name" type="text" required autocomplete="name" />
      </div>
      <div class="form__field">
        <label for="fb_phone"><span>${esc(c.label_phone || "Phone")}</span></label>
        <input id="fb_phone" name="phone" type="tel" required autocomplete="tel" />
      </div>
      <div class="form__field" style="grid-column: 1 / -1;">
        <label for="fb_email"><span>${esc(c.label_email || "Email")}</span></label>
        <input id="fb_email" name="email" type="email" required autocomplete="email" />
      </div>
      <div class="form__field" style="grid-column: 1 / -1;">
        <label for="fb_when"><span>${esc(c.label_when || "What times work for you?")}</span></label>
        <input id="fb_when" name="when" type="text" placeholder="e.g. weekday evenings or Sat morning" />
      </div>
      <div class="form__field" style="grid-column: 1 / -1;">
        <label for="fb_note"><span>${esc(c.label_message || "Anything you'd like us to know")}</span></label>
        <textarea id="fb_note" name="note" rows="4"></textarea>
      </div>
      <button type="submit" class="btn btn--primary" style="grid-column: 1 / -1; margin-top: 6px;">${esc(c.cta_label || "Request a booking")}</button>
      <p class="form__thanks" style="display: none; grid-column: 1 / -1; margin: 8px 0 0; color: var(--color-brand-dark); font-weight: 600;">${esc(c.thanks_message || "Thank you — we'll be in touch shortly.")}</p>
    </form>
  </div></section>`;
}

function formCallback(c) {
  return `<section class="section" style="background: var(--color-brand-light);"><div class="wrap" style="max-width: 560px;">
    <div style="text-align: center; margin-bottom: var(--space-md);">
      ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
      <h2>${esc(c.title || "Request a callback")}</h2>
      ${c.description ? `<p class="lead" style="color: var(--color-muted);">${esc(c.description)}</p>` : ""}
    </div>
    <form data-booking-form data-form-name="${esc(c.form_name || "callback")}" style="background: #fff; padding: var(--space-lg); border-radius: 999px; border: 1px solid var(--color-border); display: grid; grid-template-columns: 1fr 1fr auto; gap: var(--space-sm); align-items: end;">
      <div class="form__honeypot" style="position: absolute; left: -9999px; height: 0; width: 0; overflow: hidden;"><label>Leave this empty <input name="website" tabindex="-1" autocomplete="off" /></label></div>
      <div class="form__field">
        <label for="fk_name"><span>${esc(c.label_name || "Name")}</span></label>
        <input id="fk_name" name="name" type="text" required autocomplete="name" />
      </div>
      <div class="form__field">
        <label for="fk_phone"><span>${esc(c.label_phone || "Phone")}</span></label>
        <input id="fk_phone" name="phone" type="tel" required autocomplete="tel" />
      </div>
      <button type="submit" class="btn btn--primary">${esc(c.cta_label || "Call me")}</button>
      <input type="hidden" name="email" value="noreply@saymorepsychotherapy.ca" />
      <input type="hidden" name="note"  value="Callback request via website — reach out by phone." />
      <p class="form__thanks" style="display: none; grid-column: 1 / -1; margin: 8px 0 0; color: var(--color-brand-dark); font-weight: 600;">${esc(c.thanks_message || "Thank you — we'll call you shortly.")}</p>
    </form>
  </div></section>`;
}

// -----------------------------------------------------------------
// Dispatch table + section renderer
// -----------------------------------------------------------------

const SECTION_RENDERERS = {
  "hero.centered":       heroCentered,
  "hero.split":          heroSplit,
  "hero.minimal":        heroMinimal,
  "about.two-col":       aboutTwoCol,
  "about.founder":       aboutFounder,
  "about.stats":         aboutStats,
  "services.grid":       servicesGrid,
  "services.list":       servicesList,
  "services.features":   servicesFeatures,
  "faq.accordion":       faqAccordion,
  "faq.two-col":         faqTwoCol,
  "faq.cards":           faqCards,
  "cta.dark":            ctaDark,
  "cta.split":           ctaSplit,
  "cta.pill":            ctaPill,
  "steps.vertical":      stepsVertical,
  "steps.horizontal":    stepsHorizontal,
  "steps.timeline":      stepsTimeline,
  "testimonial.quote":   testimonialQuote,
  "testimonial.cards":   testimonialCards,
  "testimonial.row":     testimonialRow,
  "gallery.grid":        galleryGrid,
  "gallery.masonry":     galleryMasonry,
  "gallery.band":        galleryBand,
  "hero.dark-image":     heroDarkImage,
  "hero.dual-cta":       heroDualCta,
  "hero.badge":          heroBadge,
  "about.timeline":      aboutTimeline,
  "about.values":        aboutValues,
  "about.list":          aboutList,
  "services.icons":      servicesIcons,
  "services.pricing":    servicesPricing,
  "services.split-list": servicesSplitList,
  "faq.plain":           faqPlain,
  "faq.numbered":        faqNumbered,
  "faq.contact":         faqContact,
  "cta.newsletter":      ctaNewsletter,
  "cta.image-side":      ctaImageSide,
  "cta.two-buttons":     ctaTwoButtons,
  "steps.cards":         stepsCards,
  "steps.icon-row":      stepsIconRow,
  "steps.two-col":       stepsTwoCol,
  "testimonial.avatars": testimonialAvatars,
  "testimonial.wall":    testimonialWall,
  "testimonial.dark":    testimonialDark,
  "gallery.grid-4":      galleryGrid4,
  "gallery.mosaic":      galleryMosaic,
  "gallery.strip":       galleryStrip,
  "form.contact":        formContact,
  "form.booking":        formBooking,
  "form.callback":       formCallback,
  // Legacy names still used by the Phase 1 starter layouts
  "hero":                heroCentered,
  "text-block":          function(c){ return `<section class="section"><div class="wrap" style="max-width: 780px;">${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>`:""}${c.title ? `<h2>${esc(c.title)}</h2>`:""}${c.body ? `<p class="lead" style="white-space:pre-wrap;">${esc(c.body)}</p>`:""}</div></section>`; },
  "image-with-text":     aboutTwoCol,
  "cta":                 ctaDark,
};

function sectionKey(s) {
  if (!s || !s.type) return "";
  const type = String(s.type).toLowerCase();
  const variant = s.variant ? String(s.variant).toLowerCase() : "";
  const full = variant ? type + "." + variant : type;
  if (SECTION_RENDERERS[full]) return full;
  if (SECTION_RENDERERS[type]) return type;
  return "";
}

function renderSection(s, i) {
  const key = sectionKey(s);
  const inner = key ? SECTION_RENDERERS[key](s.content || {}) : `<!-- unknown section: ${esc(String(s && s.type))} -->`;
  // Every section is wrapped in a marker so edit-mode.js can find, hover,
  // and act on it (reorder / duplicate / delete).
  return `<div class="sm-section" data-section-index="${i}" data-section-type="${esc((s && s.type) || "")}" data-section-variant="${esc((s && s.variant) || "")}">${inner}</div>`;
}

// Render a single section WITHOUT the sm-section wrapper — used when
// inserting a library section into a static page via /api/admin/edits
// as an insert-after content patch.
export function renderSingleSection(section) {
  const key = sectionKey(section);
  if (!key) return "";
  return SECTION_RENDERERS[key](section.content || {});
}

// -----------------------------------------------------------------
// Shell HTML
// -----------------------------------------------------------------

function shellHead(page) {
  // Accept a page row (Phase 4+) OR a plain title (kept for the 404
  // fallback). Normalise both shapes into `p`.
  const p = (page && typeof page === "object") ? page : { title: page };
  const siteName = "Say More Psychotherapy";
  const brandedTitle = p.meta_title
    ? esc(p.meta_title)
    : (p.title ? `${esc(p.title)} — ${siteName}` : siteName);
  const description = esc(p.meta_description || "Compassionate, relational talk therapy in Brampton and across Ontario.");
  const slug = p.slug ? String(p.slug).replace(/^\/+/, "") : "";
  const canonicalHref = p.canonical_url
    ? esc(p.canonical_url)
    : `https://www.saymorepsychotherapy.ca/${esc(slug)}`;
  const ogImage = esc(p.og_image || "https://www.saymorepsychotherapy.ca/logo.jpg");
  const keywords = p.keywords ? `<meta name="keywords" content="${esc(p.keywords)}" />` : "";
  const robots = p.noindex ? `<meta name="robots" content="noindex, nofollow" />` : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${brandedTitle}</title>
  <meta name="description" content="${description}" />
  ${keywords}
  ${robots}
  <link rel="canonical" href="${canonicalHref}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${brandedTitle}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonicalHref}" />
  <meta property="og:image" content="${ogImage}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${brandedTitle}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${ogImage}" />
  <link rel="icon" type="image/jpeg" href="/logo.jpg" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,400;1,400;1,500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css?v=5" />
</head>`;
}
function shellHeader() {
  return `
  <header class="nav">
    <div class="wrap nav__inner">
      <a href="/" class="brand" aria-label="Say More Psychotherapy — home"><img src="/logo.jpg" alt="Say More Psychotherapy" /></a>
      <nav class="nav__links" data-primary-nav>
        <a href="/">Home</a>
        <a href="/about">About</a>
        <div class="nav__item nav__item--has-dropdown">
          <a href="/services">Services <span class="nav__item__caret">⌄</span></a>
          <div class="nav__dropdown">
            <a href="/anxiety-therapy">Anxiety Therapy</a>
            <a href="/depression-counselling">Depression Counselling</a>
            <a href="/couples-therapy">Couples Therapy</a>
            <a href="/relationship-issues">Relationship Issues</a>
            <a href="/perinatal-postpartum">Infertility, Perinatal &amp; Postpartum</a>
            <a href="/mens-issues">Men's Issues</a>
            <a href="/parenting">Parenting</a>
            <a href="/adhd">ADHD in Adults and Adolescents</a>
            <a href="/immigrants-identity">Immigrants &amp; Identity</a>
          </div>
        </div>
        <a href="/location">Location</a>
        <a href="/blog">Blog</a>
      </nav>
      <div class="nav__cta">
        <a href="tel:+16479150231" class="nav__phone"><span class="emo emo--sm">📞</span> (647) 915-0231</a>
        <a href="/consultation" class="btn btn--primary">Get Free Session</a>
      </div>
      <button class="nav__toggle" id="navToggle" aria-label="Open menu" aria-expanded="false" aria-controls="navMobile"><span class="emo emo--lg">☰</span></button>
    </div>
  </header>
  <div class="nav__mobile" id="navMobile" aria-hidden="true">
    <div class="nav__mobile__head">
      <a href="/" class="brand"><img src="/logo.jpg" alt="Say More Psychotherapy" /></a>
      <button class="nav__mobile__close" id="navClose" aria-label="Close menu"><span class="emo emo--lg">✕</span></button>
    </div>
    <nav class="nav__mobile__links" data-mobile-nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/services">Services</a>
      <a href="/location">Location</a>
      <a href="/blog">Blog</a>
    </nav>
    <div class="nav__mobile__cta">
      <a href="tel:+16479150231" class="nav__mobile__phone"><span class="emo emo--sm">📞</span> (647) 915-0231</a>
      <a href="/consultation" class="btn btn--primary">Get Free Session</a>
    </div>
  </div>`;
}
function shellFooter() {
  // Kept in sync with the footer in index.html so dynamic pages match
  // the rest of the site exactly (logo size, columns, wordmark, legal row).
  return `
  <footer class="foot">
    <div class="wrap">
      <div class="foot__top">
        <div>
          <a href="/" class="foot__logo" aria-label="Say More Psychotherapy — home">
            <img src="/logo.jpg" alt="Say More Psychotherapy" />
          </a>
          <h4>Visit</h4>
          <p>41 Edwin Drive<br/>Brampton, Ontario L6Y 1A2</p>
          <p style="margin-top: var(--space-sm)"><a href="tel:+16479150231">(647) 915-0231</a></p>
          <p><a href="mailto:info@saymorepsychotherapy.ca">info@saymorepsychotherapy.ca</a></p>
        </div>
        <div>
          <h4>Hours</h4>
          <p>Monday – Friday<br/>8 a.m. — 4 p.m.</p>
          <p style="margin-top: var(--space-sm)">Saturday &amp; Sunday<br/><em>By Appointment</em></p>
        </div>
        <div>
          <h4>Around The Site</h4>
          <div class="foot__col">
            <a href="/about">About</a>
            <a href="/services">Services</a>
            <a href="/location">Location</a>
            <a href="/blog">Blog</a>
            <a href="/consultation">Free Consultation</a>
          </div>
        </div>
        <div>
          <h4>Stay Quietly In Touch</h4>
          <p>An occasional note — never noisy. Unsubscribe anytime.</p>
          <form class="foot__sub" onsubmit="event.preventDefault(); this.querySelector('button').textContent='Thank you';">
            <input type="email" placeholder="your email" required />
            <button type="submit">Subscribe</button>
          </form>
        </div>
      </div>
      <div class="foot__wordmark">Say<span class="dot"></span>More</div>
      <div class="foot__bottom">
        <div>© <span id="footYear">2026</span> Say More Psychotherapy · Established With Care</div>
        <div class="foot__bottom__links">
          <a href="#">Privacy</a>
          <a href="/admin/login">Admin</a>
          <a href="#">CRPO Standards</a>
          <a href="#">Accessibility</a>
        </div>
      </div>
    </div>
  </footer>
  <a href="tel:+16479150231" class="call-widget" aria-label="Call Say More Psychotherapy">
    <svg class="call-widget__icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z"/></svg>
  </a>
  <script>document.getElementById('footYear').textContent = new Date().getFullYear();</script>
  <script>window.__SM_DYNAMIC_PAGE__ = true;</script>
  <script src="/script.js?v=2"></script>`;
}

export function renderPageHtml(page) {
  const sections = Array.isArray(page.sections) ? page.sections : [];
  const body = sections.map(renderSection).join("\n") ||
    `<section class="section" style="text-align: center; padding: var(--space-3xl) 0;"><div class="wrap"><p class="lead" style="color: var(--color-muted);">This page is empty. Add sections from the website editor.</p></div></section>`;
  return `${shellHead(page)}
<body>
${shellHeader()}
<main>
${body}
</main>
${shellFooter()}
</body>
</html>`;
}

export function render404Html(message) {
  const msg = esc(message || "The page you're looking for doesn't exist yet.");
  return `${shellHead({ title: "Page not found", meta_description: "Page not found", noindex: true })}
<body>
${shellHeader()}
<main>
  <section class="section" style="text-align: center; padding: var(--space-3xl) 0;">
    <div class="wrap">
      <span class="eyebrow">404</span>
      <h1>Page not found</h1>
      <p class="lead">${msg}</p>
      <div style="margin-top: var(--space-lg);"><a class="btn btn--primary" href="/">Back home</a></div>
    </div>
  </section>
</main>
${shellFooter()}
</body>
</html>`;
}

// -----------------------------------------------------------------
// Section library metadata (for the admin picker)
// preview: HTML string using monochrome wireframe primitives (.wf-*
// classes defined in admin/admin.css). Each variant's preview
// visually mirrors the section it inserts — black bars for text, black
// pills for buttons, white cards with black outlines for images.
// -----------------------------------------------------------------
export const SECTION_LIBRARY = {
  hero: {
    label: "Hero", description: "The top of a page — big intro line.",
    variants: [
      { id: "centered", label: "Centered", description: "Big centered title with a CTA button.",
        preview: `<div class="wf-section wf-center" style="padding:14px 12px;">
          <div class="wf-eyebrow">WELCOME</div>
          <div class="wf-h1">Say what you couldn't say.</div>
          <div class="wf-p">A short line that welcomes the visitor.</div>
          <div><span class="wf-btn" style="margin-top:5px">Book a free session</span></div>
        </div>`,
        defaultContent: { eyebrow: "Welcome", title: "Say what you couldn't say.", subtitle: "A short line that welcomes the visitor.", cta_label: "Book a free session", cta_href: "/consultation" } },
      { id: "split", label: "Split", description: "Text on the left, image on the right.",
        preview: `<div class="wf-section wf-row">
          <div class="wf-col" style="flex:1.2;justify-content:center;">
            <div class="wf-eyebrow">WELCOME</div>
            <div class="wf-h1">Say what you couldn't say.</div>
            <div class="wf-p">A short welcoming line.</div>
            <div><span class="wf-btn" style="margin-top:4px">Book a free session</span></div>
          </div>
          <div class="wf-col"><div class="wf-image"></div></div>
        </div>`,
        defaultContent: { eyebrow: "Welcome", title: "Say what you couldn't say.", subtitle: "A short welcoming line.", cta_label: "Book a free session", cta_href: "/consultation", image: "/logo.jpg" } },
      { id: "minimal", label: "Minimal", description: "Small eyebrow + title, nothing else.",
        preview: `<div class="wf-section wf-center" style="padding:24px 12px;">
          <div class="wf-eyebrow">NEW PAGE</div>
          <div class="wf-h1">A quiet page.</div>
          <div class="wf-hair"></div>
        </div>`,
        defaultContent: { eyebrow: "New page", title: "A quiet page." } },
      { id: "dark-image", label: "Dark image", description: "Full-bleed photo background with centred white text.",
        preview: `<div class="wf-section wf-section--dark wf-center" style="padding:20px 12px;">
          <div class="wf-eyebrow">WELCOME</div>
          <div class="wf-h1" style="color:#fff">A quiet space to be heard.</div>
          <div class="wf-p">A short welcoming line.</div>
          <div><span class="wf-btn wf-btn--white" style="margin-top:4px">Book a session</span></div>
        </div>`,
        defaultContent: { eyebrow: "Welcome", title: "A quiet space to be heard.", subtitle: "A short welcoming line.", cta_label: "Book a session", cta_href: "/consultation", image: "/cta%202.png" } },
      { id: "dual-cta", label: "Two buttons", description: "Centred hero with primary + secondary action.",
        preview: `<div class="wf-section wf-center" style="padding:16px 12px;">
          <div class="wf-eyebrow">WELCOME</div>
          <div class="wf-h1">Two ways to begin.</div>
          <div class="wf-p">Pick the one that feels right today.</div>
          <div style="display:flex;justify-content:center;gap:4px;margin-top:4px"><span class="wf-btn">Book a session</span><span class="wf-btn wf-btn--outline">Learn more</span></div>
        </div>`,
        defaultContent: { eyebrow: "Welcome", title: "Two ways to begin.", subtitle: "Pick the one that feels right today.", cta_label: "Book a session", cta_href: "/consultation", cta2_label: "Learn more", cta2_href: "/about" } },
      { id: "badge", label: "Announcement badge", description: "Highlighted pill above title — great for launches.",
        preview: `<div class="wf-section wf-center" style="padding:18px 12px;">
          <span class="wf-btn" style="font-size:5px;padding:2px 6px">NOW BOOKING</span>
          <div class="wf-h1" style="margin-top:6px">Fall openings available.</div>
          <div class="wf-p">A short line about what's new.</div>
        </div>`,
        defaultContent: { badge: "Now booking", title: "Fall openings available.", subtitle: "A short line about what's new." } },
    ],
  },
  about: {
    label: "About", description: "Introduce yourself, your work, or your team.",
    variants: [
      { id: "two-col", label: "Two-column", description: "Text on one side, image on the other.",
        preview: `<div class="wf-section wf-row">
          <div class="wf-col" style="flex:1.2;justify-content:center">
            <div class="wf-eyebrow">ABOUT</div>
            <div class="wf-h2">Two-column story</div>
            <div class="wf-p">A warm introduction — a few sentences about who this is for and what the experience is like.</div>
          </div>
          <div class="wf-col"><div class="wf-image"></div></div>
        </div>`,
        defaultContent: { eyebrow: "About", title: "Two-column story", body: "Replace this with a warm introduction — a few sentences about who this is for and what the experience is like.", image: "/logo.jpg" } },
      { id: "founder", label: "Founder card", description: "Portrait, bio, and a credentials list.",
        preview: `<div class="wf-section wf-row">
          <div class="wf-col" style="flex:0.7"><div class="wf-image wf-image--tall"></div></div>
          <div class="wf-col" style="flex:1.5;justify-content:center">
            <div class="wf-eyebrow">ABOUT THE THERAPIST</div>
            <div class="wf-h2">Paras Geramian, RP</div>
            <div class="wf-p">A short bio in your own voice.</div>
            <div style="margin-top:3px">
              <div class="wf-cred">◆ Registered Psychotherapist</div>
              <div class="wf-cred">◆ M.A. Counselling Psychology</div>
              <div class="wf-cred">◆ Member, CRPO</div>
            </div>
          </div>
        </div>`,
        defaultContent: { eyebrow: "About the therapist", title: "Paras Geramian, RP (Qualifying)", body: "A short bio in your own voice.", credentials: ["Registered Psychotherapist (Qualifying)", "M.A. Counselling Psychology", "Member, CRPO"], image: "/logo.jpg" } },
      { id: "stats", label: "Intro + stats", description: "Short intro followed by a row of stats.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-eyebrow">ABOUT</div>
          <div class="wf-h2">Why we do this work</div>
          <div class="wf-p">One or two sentences that summarise your approach.</div>
          <div class="wf-grid-3" style="margin-top:6px">
            <div class="wf-stat"><div class="wf-stat__val">5+</div><div class="wf-stat__label">Years in practice</div></div>
            <div class="wf-stat"><div class="wf-stat__val">200+</div><div class="wf-stat__label">Clients supported</div></div>
            <div class="wf-stat"><div class="wf-stat__val">100%</div><div class="wf-stat__label">Confidential</div></div>
          </div>
        </div>`,
        defaultContent: { eyebrow: "About", title: "Why we do this work", body: "One or two sentences that summarise your approach.", stats: [{value:"5+", label:"Years in practice"}, {value:"200+", label:"Clients supported"}, {value:"100%", label:"Confidential"}] } },
      { id: "timeline", label: "Milestone timeline", description: "Vertical timeline — year → event.",
        preview: `<div class="wf-section">
          <div class="wf-h2 wf-center">Our story</div>
          <div style="margin-top:5px;padding-left:8px;border-left:1.5px solid #000">
            <div style="padding:3px 0"><div class="wf-p" style="font-family:'Cormorant Garamond',serif;font-size:9px;opacity:1">2019</div><div class="wf-h3">Practice founded</div></div>
            <div style="padding:3px 0"><div class="wf-p" style="font-family:'Cormorant Garamond',serif;font-size:9px;opacity:1">2022</div><div class="wf-h3">Brampton office opens</div></div>
            <div style="padding:3px 0"><div class="wf-p" style="font-family:'Cormorant Garamond',serif;font-size:9px;opacity:1">2024</div><div class="wf-h3">Virtual sessions launched</div></div>
          </div>
        </div>`,
        defaultContent: { title: "Our story", items: [
          { year: "2019", title: "Practice founded", description: "Paras began seeing clients in a shared office." },
          { year: "2022", title: "Brampton office opens", description: "A dedicated warm, private space." },
          { year: "2024", title: "Virtual sessions launched", description: "Ontario-wide via secure video." },
        ] } },
      { id: "values", label: "Numbered values", description: "Three columns of values with big italic numbers.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">What we believe</div>
          <div class="wf-grid-3" style="margin-top:6px">
            <div><div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-style:italic;color:#000">01</div><div class="wf-h3">Relational</div><div class="wf-p wf-p--tiny">The work is the relationship.</div></div>
            <div><div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-style:italic;color:#000">02</div><div class="wf-h3">Trauma-informed</div><div class="wf-p wf-p--tiny">We move at your pace.</div></div>
            <div><div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-style:italic;color:#000">03</div><div class="wf-h3">Practical</div><div class="wf-p wf-p--tiny">Insight plus real tools.</div></div>
          </div>
        </div>`,
        defaultContent: { title: "What we believe", items: [
          { title: "Relational", description: "The work is the relationship." },
          { title: "Trauma-informed", description: "We move at your pace, never past it." },
          { title: "Practical", description: "Insight paired with real, usable tools." },
        ] } },
      { id: "list", label: "Image + checklist", description: "Image on one side, checklist on the other.",
        preview: `<div class="wf-section wf-row">
          <div class="wf-col" style="flex:1.2;justify-content:center">
            <div class="wf-eyebrow">WHAT TO EXPECT</div>
            <div class="wf-h2">Our first session</div>
            <div class="wf-p">A gentle intro to the process.</div>
            <div style="margin-top:4px">
              <div class="wf-cred">✓ 50-minute video or in-person</div>
              <div class="wf-cred">✓ Warm intake questions</div>
              <div class="wf-cred">✓ Zero-pressure fit check</div>
            </div>
          </div>
          <div class="wf-col"><div class="wf-image"></div></div>
        </div>`,
        defaultContent: { eyebrow: "What to expect", title: "Our first session", body: "A gentle intro to the process.", bullets: ["50-minute video or in-person session", "Warm intake questions, no assessments", "Zero-pressure fit check at the end"], image: "/logo.jpg" } },
    ],
  },
  services: {
    label: "Services", description: "Show what you offer.",
    variants: [
      { id: "grid", label: "Card grid", description: "Three service cards with images.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">What we offer</div>
          <div class="wf-grid-3" style="margin-top:5px;text-align:left">
            <div class="wf-card">
              <div class="wf-image" style="aspect-ratio:1"></div>
              <div class="wf-h3" style="margin-top:3px">Anxiety Therapy</div>
              <div class="wf-p wf-p--tiny">$150 CAD</div>
              <div class="wf-link">Learn more →</div>
            </div>
            <div class="wf-card">
              <div class="wf-image" style="aspect-ratio:1"></div>
              <div class="wf-h3" style="margin-top:3px">Depression</div>
              <div class="wf-p wf-p--tiny">$150 CAD</div>
              <div class="wf-link">Learn more →</div>
            </div>
            <div class="wf-card">
              <div class="wf-image" style="aspect-ratio:1"></div>
              <div class="wf-h3" style="margin-top:3px">Couples</div>
              <div class="wf-p wf-p--tiny">$150 CAD</div>
              <div class="wf-link">Learn more →</div>
            </div>
          </div>
        </div>`,
        defaultContent: { title: "What we offer", items: [
          { title: "Anxiety Therapy", description: "For the racing thoughts, the tight chest.", image: "/logo.jpg", cta_label: "Learn more", cta_href: "/anxiety-therapy" },
          { title: "Depression Counselling", description: "Gentle, steady work.", image: "/logo.jpg", cta_label: "Learn more", cta_href: "/depression-counselling" },
          { title: "Couples Therapy", description: "For two people ready to be heard.", image: "/logo.jpg", cta_label: "Learn more", cta_href: "/couples-therapy" },
        ] } },
      { id: "list", label: "Long list", description: "Row-per-service, quiet and text-forward.",
        preview: `<div class="wf-section">
          <div class="wf-h2">Services</div>
          <div style="margin-top:4px">
            <div class="wf-list-row"><div><div class="wf-h3">Anxiety Therapy</div><div class="wf-p wf-p--tiny">Practical tools + support</div></div><span class="wf-btn wf-btn--outline wf-btn--sm">Learn more</span></div>
            <div class="wf-list-row"><div><div class="wf-h3">Depression Counselling</div><div class="wf-p wf-p--tiny">For the heaviness</div></div><span class="wf-btn wf-btn--outline wf-btn--sm">Learn more</span></div>
            <div class="wf-list-row"><div><div class="wf-h3">Couples Therapy</div><div class="wf-p wf-p--tiny">Repair &amp; reconnect</div></div><span class="wf-btn wf-btn--outline wf-btn--sm">Learn more</span></div>
            <div class="wf-list-row"><div><div class="wf-h3">Parenting</div><div class="wf-p wf-p--tiny">The impossible seasons</div></div><span class="wf-btn wf-btn--outline wf-btn--sm">Learn more</span></div>
          </div>
        </div>`,
        defaultContent: { title: "Services", items: [
          { title: "Anxiety Therapy", description: "Practical tools + relational support.", cta_label: "Learn more", cta_href: "/anxiety-therapy" },
          { title: "Depression Counselling", description: "For the heaviness that hasn't lifted.", cta_label: "Learn more", cta_href: "/depression-counselling" },
          { title: "Couples Therapy", description: "For repair and re-connection.", cta_label: "Learn more", cta_href: "/couples-therapy" },
          { title: "Parenting", description: "For the impossible-feeling seasons.", cta_label: "Learn more", cta_href: "/parenting" },
        ] } },
      { id: "features", label: "Feature comparison", description: "Three feature columns with bullet points.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">How we work</div>
          <div class="wf-grid-3" style="margin-top:5px;text-align:left">
            <div class="wf-card">
              <div class="wf-h3">In person</div>
              <div class="wf-bullet-list"><div>✓ Brampton office</div><div>✓ Private space</div><div>✓ Evenings</div></div>
            </div>
            <div class="wf-card">
              <div class="wf-h3">Virtually</div>
              <div class="wf-bullet-list"><div>✓ Ontario-wide</div><div>✓ Secure video</div><div>✓ Same fees</div></div>
            </div>
            <div class="wf-card">
              <div class="wf-h3">Sliding scale</div>
              <div class="wf-bullet-list"><div>✓ Ask about</div><div>✓ No paperwork</div><div>✓ Confidential</div></div>
            </div>
          </div>
        </div>`,
        defaultContent: { title: "How we work", items: [
          { title: "In person", bullets: ["Brampton office", "Private, warm space", "Evening slots available"] },
          { title: "Virtually", bullets: ["Ontario-wide", "Secure video", "Same fees"] },
          { title: "Sliding scale", bullets: ["Ask about availability", "No paperwork required", "Confidential"] },
        ] } },
      { id: "icons", label: "Icon grid", description: "Three services with a small icon disc each — no images.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">What we offer</div>
          <div class="wf-grid-3" style="margin-top:5px">
            <div><div style="width:20px;height:20px;border-radius:50%;background:#fff;border:1px solid #000;margin:0 auto 3px;display:flex;align-items:center;justify-content:center;font-size:9px">◆</div><div class="wf-h3">Individual</div><div class="wf-p wf-p--tiny">One-on-one work.</div></div>
            <div><div style="width:20px;height:20px;border-radius:50%;background:#fff;border:1px solid #000;margin:0 auto 3px;display:flex;align-items:center;justify-content:center;font-size:9px">◆</div><div class="wf-h3">Couples</div><div class="wf-p wf-p--tiny">Repair &amp; reconnect.</div></div>
            <div><div style="width:20px;height:20px;border-radius:50%;background:#fff;border:1px solid #000;margin:0 auto 3px;display:flex;align-items:center;justify-content:center;font-size:9px">◆</div><div class="wf-h3">Family</div><div class="wf-p wf-p--tiny">Whole-system support.</div></div>
          </div>
        </div>`,
        defaultContent: { title: "What we offer", items: [
          { icon: "◆", title: "Individual", description: "One-on-one work at your pace." },
          { icon: "❤", title: "Couples", description: "Repair, reconnect, and be heard." },
          { icon: "☘", title: "Family", description: "Whole-system support." },
        ] } },
      { id: "pricing", label: "Pricing tiers", description: "Three columns with price, features, and a CTA.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">Session rates</div>
          <div class="wf-grid-3" style="margin-top:5px;text-align:left">
            <div class="wf-card"><div class="wf-h3">Intro</div><div style="font-family:'Cormorant Garamond',serif;font-size:14px">$0</div><div class="wf-p wf-p--tiny">15 min</div><div class="wf-btn" style="width:100%;text-align:center;margin-top:3px">Book</div></div>
            <div class="wf-card"><div class="wf-h3">Standard</div><div style="font-family:'Cormorant Garamond',serif;font-size:14px">$150</div><div class="wf-p wf-p--tiny">50 min</div><div class="wf-btn" style="width:100%;text-align:center;margin-top:3px">Book</div></div>
            <div class="wf-card"><div class="wf-h3">Extended</div><div style="font-family:'Cormorant Garamond',serif;font-size:14px">$220</div><div class="wf-p wf-p--tiny">80 min</div><div class="wf-btn" style="width:100%;text-align:center;margin-top:3px">Book</div></div>
          </div>
        </div>`,
        defaultContent: { title: "Session rates", items: [
          { title: "Intro", price: "$0",   period: "15 min consultation", features: ["Fit check", "No pressure", "Video only"], cta_label: "Book",    cta_href: "/consultation" },
          { title: "Standard", price: "$150", period: "50-minute session",   features: ["Weekly or bi-weekly", "In-person or virtual", "Receipts provided"], cta_label: "Book", cta_href: "/consultation", featured: true },
          { title: "Extended", price: "$220", period: "80-minute session",   features: ["For couples work", "For deeper sessions", "Weekly cadence"], cta_label: "Book", cta_href: "/consultation" },
        ] } },
      { id: "split-list", label: "Two-column detail", description: "Half-width service blocks with more copy per row.",
        preview: `<div class="wf-section">
          <div class="wf-h2 wf-center">Areas of focus</div>
          <div class="wf-grid-2" style="margin-top:6px">
            <div class="wf-quote-block"><div class="wf-h3">Anxiety</div><div class="wf-p wf-p--tiny">Racing thoughts, tight chest.</div></div>
            <div class="wf-quote-block"><div class="wf-h3">Depression</div><div class="wf-p wf-p--tiny">For the heaviness.</div></div>
            <div class="wf-quote-block"><div class="wf-h3">Couples</div><div class="wf-p wf-p--tiny">Repair &amp; reconnect.</div></div>
            <div class="wf-quote-block"><div class="wf-h3">Parenting</div><div class="wf-p wf-p--tiny">Impossible seasons.</div></div>
          </div>
        </div>`,
        defaultContent: { title: "Areas of focus", items: [
          { title: "Anxiety",     description: "For the racing thoughts, the tight chest, the late-night spirals.", cta_label: "Learn more", cta_href: "/anxiety-therapy" },
          { title: "Depression",  description: "Gentle, steady work for the heaviness that hasn't lifted.",         cta_label: "Learn more", cta_href: "/depression-counselling" },
          { title: "Couples",     description: "For two people ready to feel heard again.",                          cta_label: "Learn more", cta_href: "/couples-therapy" },
          { title: "Parenting",   description: "For the impossible-feeling seasons.",                                cta_label: "Learn more", cta_href: "/parenting" },
        ] } },
    ],
  },
  faq: {
    label: "FAQ", description: "Answer common questions.",
    variants: [
      { id: "accordion", label: "Accordion", description: "Click-to-expand questions.",
        preview: `<div class="wf-section">
          <div class="wf-h2 wf-center">Common questions</div>
          <div style="margin-top:4px">
            <div class="wf-acc"><span>How long is a session?</span><span class="wf-acc__plus">+</span></div>
            <div class="wf-acc"><span>How much does it cost?</span><span class="wf-acc__plus">+</span></div>
            <div class="wf-acc"><span>Do you see couples?</span><span class="wf-acc__plus">+</span></div>
            <div class="wf-acc"><span>Where are you located?</span><span class="wf-acc__plus">+</span></div>
            <div class="wf-acc"><span>How do I book?</span><span class="wf-acc__plus">+</span></div>
          </div>
        </div>`,
        defaultContent: { title: "Common questions", items: [
          { q: "How long is a session?", a: "50 minutes, weekly or bi-weekly." },
          { q: "How much does it cost?", a: "$150 per session. Insurance and receipts available." },
          { q: "Do you see couples?", a: "Yes — couples work is one of our specialties." },
          { q: "Where are you located?", a: "In Brampton, and virtually across Ontario." },
          { q: "How do I book?", a: "Send us a message and we'll set up a free 15-minute intro call." },
        ] } },
      { id: "two-col", label: "Two-column grid", description: "Grid of Q&A pairs.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">Questions</div>
          <div class="wf-grid-2" style="margin-top:6px;text-align:left">
            <div><div class="wf-h3">How long?</div><div class="wf-p wf-p--tiny">50 minutes.</div></div>
            <div><div class="wf-h3">How much?</div><div class="wf-p wf-p--tiny">$150 per session.</div></div>
            <div><div class="wf-h3">Insurance?</div><div class="wf-p wf-p--tiny">Receipts available.</div></div>
            <div><div class="wf-h3">Booking?</div><div class="wf-p wf-p--tiny">Free intro first.</div></div>
          </div>
        </div>`,
        defaultContent: { title: "Questions", items: [
          { q: "How long is a session?", a: "50 minutes." },
          { q: "How much?", a: "$150 per session." },
          { q: "Insurance?", a: "Yes — receipts available." },
          { q: "Booking?", a: "Free 15-min intro first." },
        ] } },
      { id: "cards", label: "Compact cards", description: "Small card grid, six questions.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">Quick answers</div>
          <div class="wf-grid-3" style="margin-top:5px;text-align:left">
            <div class="wf-card"><div class="wf-q">?</div><div class="wf-h3">How long?</div><div class="wf-p wf-p--tiny">50 minutes.</div></div>
            <div class="wf-card"><div class="wf-q">?</div><div class="wf-h3">How much?</div><div class="wf-p wf-p--tiny">$150.</div></div>
            <div class="wf-card"><div class="wf-q">?</div><div class="wf-h3">Where?</div><div class="wf-p wf-p--tiny">Brampton.</div></div>
            <div class="wf-card"><div class="wf-q">?</div><div class="wf-h3">Insurance?</div><div class="wf-p wf-p--tiny">Receipts.</div></div>
            <div class="wf-card"><div class="wf-q">?</div><div class="wf-h3">Couples?</div><div class="wf-p wf-p--tiny">Yes.</div></div>
            <div class="wf-card"><div class="wf-q">?</div><div class="wf-h3">First step?</div><div class="wf-p wf-p--tiny">Free call.</div></div>
          </div>
        </div>`,
        defaultContent: { title: "Quick answers", items: [
          { q: "How long?", a: "50 minutes." }, { q: "How much?", a: "$150." },
          { q: "Where?", a: "Brampton + virtual." }, { q: "Insurance?", a: "Receipts provided." },
          { q: "Couples?", a: "Yes." }, { q: "First step?", a: "Free intro call." },
        ] } },
      { id: "plain", label: "Plain stack", description: "No accordion — questions and answers always visible.",
        preview: `<div class="wf-section">
          <div class="wf-h2 wf-center">Questions</div>
          <div style="margin-top:5px">
            <div style="padding:4px 0;border-bottom:1px solid #000"><div class="wf-h3">How long is a session?</div><div class="wf-p wf-p--tiny">50 minutes.</div></div>
            <div style="padding:4px 0;border-bottom:1px solid #000"><div class="wf-h3">How much?</div><div class="wf-p wf-p--tiny">$150 per session.</div></div>
            <div style="padding:4px 0"><div class="wf-h3">Insurance?</div><div class="wf-p wf-p--tiny">Receipts provided.</div></div>
          </div>
        </div>`,
        defaultContent: { title: "Questions", items: [
          { q: "How long is a session?", a: "50 minutes, weekly or bi-weekly." },
          { q: "How much does it cost?", a: "$150 per session. Receipts provided." },
          { q: "Insurance coverage?", a: "Most extended benefits reimburse; ask us." },
          { q: "Where are you located?", a: "In Brampton, and virtually across Ontario." },
        ] } },
      { id: "numbered", label: "Numbered cards", description: "Each Q gets its own numbered card.",
        preview: `<div class="wf-section">
          <div class="wf-h2 wf-center">Common questions</div>
          <div class="wf-stack" style="margin-top:5px">
            <div class="wf-card" style="display:grid;grid-template-columns:16px 1fr;gap:5px;padding:5px 8px"><div style="font-family:'Cormorant Garamond',serif;font-size:12px">01</div><div><div class="wf-h3">How long is a session?</div><div class="wf-p wf-p--tiny">50 minutes.</div></div></div>
            <div class="wf-card" style="display:grid;grid-template-columns:16px 1fr;gap:5px;padding:5px 8px"><div style="font-family:'Cormorant Garamond',serif;font-size:12px">02</div><div><div class="wf-h3">How much?</div><div class="wf-p wf-p--tiny">$150.</div></div></div>
            <div class="wf-card" style="display:grid;grid-template-columns:16px 1fr;gap:5px;padding:5px 8px"><div style="font-family:'Cormorant Garamond',serif;font-size:12px">03</div><div><div class="wf-h3">Insurance?</div><div class="wf-p wf-p--tiny">Receipts provided.</div></div></div>
          </div>
        </div>`,
        defaultContent: { title: "Common questions", items: [
          { q: "How long is a session?", a: "50 minutes." },
          { q: "How much does it cost?", a: "$150 per session." },
          { q: "Insurance coverage?", a: "Receipts provided for extended benefits." },
        ] } },
      { id: "contact", label: "FAQ + contact card", description: "Accordion on the left, contact CTA on the right.",
        preview: `<div class="wf-section wf-row">
          <div class="wf-col" style="flex:1.4">
            <div class="wf-h2">FAQ</div>
            <div style="margin-top:4px"><div class="wf-acc"><span>How long?</span><span class="wf-acc__plus">+</span></div><div class="wf-acc"><span>How much?</span><span class="wf-acc__plus">+</span></div><div class="wf-acc"><span>Insurance?</span><span class="wf-acc__plus">+</span></div></div>
          </div>
          <div class="wf-col">
            <div class="wf-card"><div class="wf-h3">Still have questions?</div><div class="wf-p wf-p--tiny">Free 15-min consultation.</div><div class="wf-btn" style="width:100%;text-align:center;margin-top:3px">Book a call</div></div>
          </div>
        </div>`,
        defaultContent: { title: "Have a question?", items: [
          { q: "How long is a session?", a: "50 minutes." },
          { q: "How much does it cost?", a: "$150 per session." },
          { q: "Insurance coverage?", a: "Receipts provided." },
        ], cta_title: "Still have questions?", cta_body: "Book a free 15-minute consultation and we'll answer them.", cta_label: "Book a call", cta_href: "/consultation" } },
    ],
  },
  cta: {
    label: "Call to action", description: "Ask visitors to take the next step.",
    variants: [
      { id: "dark", label: "Full-width banner", description: "Dark background, centered CTA.",
        preview: `<div class="wf-section wf-section--dark wf-center">
          <div class="wf-eyebrow">READY WHEN YOU ARE</div>
          <div class="wf-h1" style="color:#fff">Book a free consultation</div>
          <div class="wf-p">No pressure. Just a conversation.</div>
          <div><span class="wf-btn wf-btn--white" style="margin-top:4px">Get started</span></div>
        </div>`,
        defaultContent: { eyebrow: "Ready when you are", title: "Book a free 15-minute consultation", subtitle: "No pressure. Just a conversation.", cta_label: "Get started", cta_href: "/consultation" } },
      { id: "split", label: "Text + form", description: "Copy on the left, contact form on the right.",
        preview: `<div class="wf-section wf-row">
          <div class="wf-col" style="flex:1.1;justify-content:center">
            <div class="wf-eyebrow">REACH OUT</div>
            <div class="wf-h2">Let's start a conversation</div>
            <div class="wf-p">A free 15-minute consultation.</div>
          </div>
          <div class="wf-col">
            <div class="wf-card">
              <div class="wf-h3">Book a free consultation</div>
              <div class="wf-input">Your name</div>
              <div class="wf-input">Email address</div>
              <div class="wf-btn" style="width:100%;text-align:center;margin-top:3px">Send</div>
            </div>
          </div>
        </div>`,
        defaultContent: { eyebrow: "Reach out", title: "Let's start with a conversation", subtitle: "A free 15-minute consultation to see if we're a good fit.", form_title: "Book a free consultation", cta_label: "Send", cta_href: "/consultation" } },
      { id: "pill", label: "Pill", description: "Small inline callout with a button.",
        preview: `<div class="wf-section" style="padding:16px 12px">
          <div class="wf-pill">
            <span>Have questions? Let's talk.</span>
            <span class="wf-btn wf-btn--sm">Book a call</span>
          </div>
        </div>`,
        defaultContent: { title: "Have questions? Let's talk.", cta_label: "Book a call", cta_href: "/consultation" } },
      { id: "newsletter", label: "Newsletter", description: "Email subscribe field with a Send button.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-eyebrow">STAY IN TOUCH</div>
          <div class="wf-h2">Occasional notes</div>
          <div class="wf-p">Never noisy.</div>
          <div style="display:flex;gap:3px;justify-content:center;margin-top:5px"><div class="wf-input" style="width:55%">your email</div><div class="wf-btn">Subscribe</div></div>
        </div>`,
        defaultContent: { eyebrow: "Stay in touch", title: "Occasional notes", subtitle: "Never noisy. Unsubscribe anytime.", cta_label: "Subscribe", placeholder: "your email" } },
      { id: "image-side", label: "Image + text", description: "Image on the left, headline + CTA on the right.",
        preview: `<div class="wf-section wf-row">
          <div class="wf-col"><div class="wf-image"></div></div>
          <div class="wf-col" style="justify-content:center">
            <div class="wf-eyebrow">REACH OUT</div>
            <div class="wf-h2">Let's start with a conversation</div>
            <div class="wf-p">A free 15-minute consultation.</div>
            <div><span class="wf-btn" style="margin-top:4px">Book a call</span></div>
          </div>
        </div>`,
        defaultContent: { eyebrow: "Reach out", title: "Let's start with a conversation", subtitle: "A free 15-minute consultation to see if we're a good fit.", cta_label: "Book a call", cta_href: "/consultation", image: "/logo.jpg" } },
      { id: "two-buttons", label: "Two buttons", description: "Big centred question with primary + ghost buttons.",
        preview: `<div class="wf-section wf-center" style="padding:16px 12px">
          <div class="wf-h2">How can we help?</div>
          <div class="wf-p">Pick the path that feels right.</div>
          <div style="display:flex;justify-content:center;gap:4px;margin-top:4px"><span class="wf-btn">Book a session</span><span class="wf-btn wf-btn--outline">Learn more</span></div>
        </div>`,
        defaultContent: { title: "How can we help?", subtitle: "Pick the path that feels right today.", cta_label: "Book a session", cta_href: "/consultation", cta2_label: "Learn more about us", cta2_href: "/about" } },
    ],
  },
  steps: {
    label: "How it works", description: "Explain a numbered process.",
    variants: [
      { id: "vertical", label: "Numbered vertical", description: "1-2-3 stacked, each with a description.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">How it works</div>
          <div class="wf-stack" style="margin-top:5px;text-align:left">
            <div class="wf-step"><div class="wf-step__num">1</div><div class="wf-col"><div class="wf-h3">Reach out</div><div class="wf-p wf-p--tiny">Send a message or book intro.</div></div></div>
            <div class="wf-step"><div class="wf-step__num">2</div><div class="wf-col"><div class="wf-h3">Meet</div><div class="wf-p wf-p--tiny">Chat, see if it's a fit.</div></div></div>
            <div class="wf-step"><div class="wf-step__num">3</div><div class="wf-col"><div class="wf-h3">Begin</div><div class="wf-p wf-p--tiny">Weekly or bi-weekly sessions.</div></div></div>
          </div>
        </div>`,
        defaultContent: { title: "How it works", items: [
          { title: "Reach out", description: "Send a message or book a free 15-min intro." },
          { title: "Meet", description: "We chat, see if it's a good fit, and pick a time." },
          { title: "Begin", description: "Weekly or bi-weekly sessions, in person or online." },
        ] } },
      { id: "horizontal", label: "Horizontal row", description: "Three columns side-by-side.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">The process</div>
          <div class="wf-grid-3" style="margin-top:5px">
            <div><div class="wf-num--big">1</div><div class="wf-h3">Reach out</div><div class="wf-p wf-p--tiny">Send a message.</div></div>
            <div><div class="wf-num--big">2</div><div class="wf-h3">Meet</div><div class="wf-p wf-p--tiny">Free 15-min intro.</div></div>
            <div><div class="wf-num--big">3</div><div class="wf-h3">Begin</div><div class="wf-p wf-p--tiny">Weekly sessions.</div></div>
          </div>
        </div>`,
        defaultContent: { title: "The process", items: [
          { title: "Reach out", description: "Send us a message." },
          { title: "Meet", description: "Free 15-min intro." },
          { title: "Begin", description: "Weekly sessions." },
        ] } },
      { id: "timeline", label: "Timeline", description: "Dots connected by a line.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">What to expect</div>
          <div class="wf-timeline">
            <div class="wf-tl-item"><div class="wf-tl-dot"></div><div class="wf-h3" style="font-size:6px">Message</div><div class="wf-p wf-p--tiny">Same week</div></div>
            <div class="wf-tl-item"><div class="wf-tl-dot"></div><div class="wf-h3" style="font-size:6px">Intro call</div><div class="wf-p wf-p--tiny">15 free min</div></div>
            <div class="wf-tl-item"><div class="wf-tl-dot"></div><div class="wf-h3" style="font-size:6px">First session</div><div class="wf-p wf-p--tiny">1-2 weeks</div></div>
            <div class="wf-tl-item"><div class="wf-tl-dot"></div><div class="wf-h3" style="font-size:6px">Ongoing</div><div class="wf-p wf-p--tiny">Your pace</div></div>
          </div>
        </div>`,
        defaultContent: { title: "What to expect", items: [
          { title: "Message", description: "Same-week reply." },
          { title: "Intro call", description: "15 free minutes." },
          { title: "First session", description: "Within 1–2 weeks." },
          { title: "Ongoing", description: "At your pace." },
        ] } },
      { id: "cards", label: "Numbered cards", description: "Big number cards with a description underneath.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">The process</div>
          <div class="wf-grid-3" style="margin-top:5px;text-align:left">
            <div class="wf-card"><div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-style:italic">01</div><div class="wf-h3">Reach out</div><div class="wf-p wf-p--tiny">Send a message.</div></div>
            <div class="wf-card"><div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-style:italic">02</div><div class="wf-h3">Meet</div><div class="wf-p wf-p--tiny">Free 15-min intro.</div></div>
            <div class="wf-card"><div style="font-family:'Cormorant Garamond',serif;font-size:22px;font-style:italic">03</div><div class="wf-h3">Begin</div><div class="wf-p wf-p--tiny">Weekly sessions.</div></div>
          </div>
        </div>`,
        defaultContent: { title: "The process", items: [
          { title: "Reach out", description: "Send us a message or book a free intro." },
          { title: "Meet", description: "A short chat to see if we're a good fit." },
          { title: "Begin", description: "Weekly or bi-weekly sessions, in person or online." },
        ] } },
      { id: "icon-row", label: "Icon row", description: "Three round icon discs with title + description.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">How it flows</div>
          <div class="wf-grid-3" style="margin-top:5px">
            <div><div style="width:22px;height:22px;border-radius:50%;background:#000;color:#fff;font-size:9px;line-height:22px;margin:0 auto 3px">◆</div><div class="wf-h3">Reach out</div><div class="wf-p wf-p--tiny">Send a message.</div></div>
            <div><div style="width:22px;height:22px;border-radius:50%;background:#000;color:#fff;font-size:9px;line-height:22px;margin:0 auto 3px">◆</div><div class="wf-h3">Meet</div><div class="wf-p wf-p--tiny">15-min intro.</div></div>
            <div><div style="width:22px;height:22px;border-radius:50%;background:#000;color:#fff;font-size:9px;line-height:22px;margin:0 auto 3px">◆</div><div class="wf-h3">Begin</div><div class="wf-p wf-p--tiny">Weekly cadence.</div></div>
          </div>
        </div>`,
        defaultContent: { title: "How it flows", items: [
          { icon: "✎", title: "Reach out", description: "Send us a message." },
          { icon: "☕", title: "Meet",      description: "A 15-min intro call." },
          { icon: "◆", title: "Begin",     description: "Weekly cadence." },
        ] } },
      { id: "two-col", label: "Two-column steps", description: "Four steps in a 2×2 grid with small numbered chips.",
        preview: `<div class="wf-section">
          <div class="wf-h2 wf-center">What to expect</div>
          <div class="wf-grid-2" style="margin-top:5px">
            <div style="display:grid;grid-template-columns:16px 1fr;gap:4px"><div style="width:14px;height:14px;border-radius:50%;background:#000;color:#fff;font-size:7px;line-height:14px;text-align:center">1</div><div><div class="wf-h3">Message</div><div class="wf-p wf-p--tiny">Same-week reply.</div></div></div>
            <div style="display:grid;grid-template-columns:16px 1fr;gap:4px"><div style="width:14px;height:14px;border-radius:50%;background:#000;color:#fff;font-size:7px;line-height:14px;text-align:center">2</div><div><div class="wf-h3">Intro call</div><div class="wf-p wf-p--tiny">15 min, free.</div></div></div>
            <div style="display:grid;grid-template-columns:16px 1fr;gap:4px"><div style="width:14px;height:14px;border-radius:50%;background:#000;color:#fff;font-size:7px;line-height:14px;text-align:center">3</div><div><div class="wf-h3">First session</div><div class="wf-p wf-p--tiny">Within 1-2 weeks.</div></div></div>
            <div style="display:grid;grid-template-columns:16px 1fr;gap:4px"><div style="width:14px;height:14px;border-radius:50%;background:#000;color:#fff;font-size:7px;line-height:14px;text-align:center">4</div><div><div class="wf-h3">Ongoing</div><div class="wf-p wf-p--tiny">Your pace.</div></div></div>
          </div>
        </div>`,
        defaultContent: { title: "What to expect", items: [
          { title: "Message", description: "Same-week reply." },
          { title: "Intro call", description: "15 minutes, free." },
          { title: "First session", description: "Within 1–2 weeks." },
          { title: "Ongoing", description: "At your pace, always." },
        ] } },
    ],
  },
  testimonial: {
    label: "Testimonials", description: "Share what people have said.",
    variants: [
      { id: "quote", label: "Single big quote", description: "One large centered quote.",
        preview: `<div class="wf-section wf-center" style="padding:14px 12px">
          <div class="wf-quote-mark">"</div>
          <div class="wf-h2" style="font-style:italic;font-size:9px">Their care changed everything for me.</div>
          <div class="wf-p" style="margin-top:5px">— Anonymous client</div>
        </div>`,
        defaultContent: { quote: "Their care changed everything for me.", author: "Anonymous client", role: "" } },
      { id: "cards", label: "Three cards", description: "Three testimonial cards with ratings.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">What people say</div>
          <div class="wf-grid-3" style="margin-top:5px;text-align:left">
            <div class="wf-card"><div class="wf-stars">★★★★★</div><div class="wf-p" style="font-style:italic">"I felt heard for the first time."</div><div class="wf-p wf-p--tiny">— A.M.</div></div>
            <div class="wf-card"><div class="wf-stars">★★★★★</div><div class="wf-p" style="font-style:italic">"This changed how I show up."</div><div class="wf-p wf-p--tiny">— R.K.</div></div>
            <div class="wf-card"><div class="wf-stars">★★★★★</div><div class="wf-p" style="font-style:italic">"Warm, patient, real."</div><div class="wf-p wf-p--tiny">— S.P.</div></div>
          </div>
        </div>`,
        defaultContent: { title: "What people say", items: [
          { quote: "I felt heard for the first time.", author: "A.M.", role: "Anxiety client", rating: 5 },
          { quote: "This work changed how I show up.", author: "R.K.", role: "Couples work", rating: 5 },
          { quote: "Warm, patient, real.", author: "S.P.", role: "Parenting support", rating: 5 },
        ] } },
      { id: "row", label: "Quote wall", description: "A row of shorter quotes.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">In their own words</div>
          <div style="margin-top:5px;display:grid;grid-template-columns:repeat(4,1fr);gap:5px;text-align:left">
            <div class="wf-quote-block"><div class="wf-p" style="font-style:italic">"I finally felt heard."</div><div class="wf-p wf-p--tiny">— A.M.</div></div>
            <div class="wf-quote-block"><div class="wf-p" style="font-style:italic">"Warm and grounded."</div><div class="wf-p wf-p--tiny">— R.K.</div></div>
            <div class="wf-quote-block"><div class="wf-p" style="font-style:italic">"Best decision."</div><div class="wf-p wf-p--tiny">— S.P.</div></div>
            <div class="wf-quote-block"><div class="wf-p" style="font-style:italic">"Safe place."</div><div class="wf-p wf-p--tiny">— J.T.</div></div>
          </div>
        </div>`,
        defaultContent: { title: "In their own words", items: [
          { quote: "I finally felt heard.", author: "A.M." },
          { quote: "Warm and grounded.", author: "R.K." },
          { quote: "The best decision I made this year.", author: "S.P." },
          { quote: "A safe place to think.", author: "J.T." },
          { quote: "Real change, not band-aids.", author: "L.B." },
        ] } },
      { id: "avatars", label: "Avatar cards", description: "Three centred cards with circular avatar photos.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">Testimonials</div>
          <div class="wf-grid-3" style="margin-top:5px">
            <div class="wf-card wf-center"><div style="width:20px;height:20px;border-radius:50%;background:#fff;border:1px solid #000;margin:0 auto 3px"></div><div class="wf-stars">★★★★★</div><div class="wf-p wf-p--tiny" style="font-style:italic">"I felt heard."</div><div class="wf-p wf-p--tiny">— A.M.</div></div>
            <div class="wf-card wf-center"><div style="width:20px;height:20px;border-radius:50%;background:#fff;border:1px solid #000;margin:0 auto 3px"></div><div class="wf-stars">★★★★★</div><div class="wf-p wf-p--tiny" style="font-style:italic">"Real change."</div><div class="wf-p wf-p--tiny">— R.K.</div></div>
            <div class="wf-card wf-center"><div style="width:20px;height:20px;border-radius:50%;background:#fff;border:1px solid #000;margin:0 auto 3px"></div><div class="wf-stars">★★★★★</div><div class="wf-p wf-p--tiny" style="font-style:italic">"Warm, real."</div><div class="wf-p wf-p--tiny">— S.P.</div></div>
          </div>
        </div>`,
        defaultContent: { title: "Testimonials", items: [
          { quote: "I felt heard for the first time.", author: "A.M.", role: "Anxiety client",    rating: 5, avatar: "/logo.jpg" },
          { quote: "Real change, not band-aids.",     author: "R.K.", role: "Couples work",      rating: 5, avatar: "/logo.jpg" },
          { quote: "Warm, patient, real.",            author: "S.P.", role: "Parenting support", rating: 5, avatar: "/logo.jpg" },
        ] } },
      { id: "wall", label: "Quote wall (masonry)", description: "Masonry-style scattered quote cards.",
        preview: `<div class="wf-section">
          <div class="wf-h2 wf-center">Kind words</div>
          <div style="margin-top:5px;columns:3;column-gap:4px">
            <div class="wf-card" style="margin-bottom:4px;break-inside:avoid"><div class="wf-p wf-p--tiny" style="font-style:italic">"I finally felt heard."</div><div class="wf-p wf-p--tiny">— A.M.</div></div>
            <div class="wf-card" style="margin-bottom:4px;break-inside:avoid"><div class="wf-p wf-p--tiny" style="font-style:italic">"Warm and grounded. Truly."</div><div class="wf-p wf-p--tiny">— R.K.</div></div>
            <div class="wf-card" style="margin-bottom:4px;break-inside:avoid"><div class="wf-p wf-p--tiny" style="font-style:italic">"Best decision."</div><div class="wf-p wf-p--tiny">— S.P.</div></div>
            <div class="wf-card" style="margin-bottom:4px;break-inside:avoid"><div class="wf-p wf-p--tiny" style="font-style:italic">"Safe."</div><div class="wf-p wf-p--tiny">— J.T.</div></div>
            <div class="wf-card" style="margin-bottom:4px;break-inside:avoid"><div class="wf-p wf-p--tiny" style="font-style:italic">"Real change."</div><div class="wf-p wf-p--tiny">— L.B.</div></div>
          </div>
        </div>`,
        defaultContent: { title: "Kind words", items: [
          { quote: "I finally felt heard.", author: "A.M." },
          { quote: "Warm and grounded. Truly life-changing.", author: "R.K." },
          { quote: "The best decision I made this year.", author: "S.P." },
          { quote: "A safe place to think.", author: "J.T." },
          { quote: "Real change, not band-aids.", author: "L.B." },
        ] } },
      { id: "dark", label: "Dark background", description: "Espresso-dark section with gold stars.",
        preview: `<div class="wf-section wf-section--dark wf-center">
          <div class="wf-h2" style="color:#fff">What people say</div>
          <div class="wf-grid-3" style="margin-top:5px;text-align:left">
            <div><div class="wf-stars" style="color:#D4A64A">★★★★★</div><div class="wf-p" style="font-style:italic;color:#fff">"I felt heard."</div><div class="wf-p wf-p--tiny">— A.M.</div></div>
            <div><div class="wf-stars" style="color:#D4A64A">★★★★★</div><div class="wf-p" style="font-style:italic;color:#fff">"Warm, real."</div><div class="wf-p wf-p--tiny">— R.K.</div></div>
            <div><div class="wf-stars" style="color:#D4A64A">★★★★★</div><div class="wf-p" style="font-style:italic;color:#fff">"Real change."</div><div class="wf-p wf-p--tiny">— S.P.</div></div>
          </div>
        </div>`,
        defaultContent: { title: "What people say", star_color: "#D4A64A", items: [
          { quote: "I felt heard for the first time.", author: "A.M.", rating: 5 },
          { quote: "Warm, patient, real.",             author: "R.K.", rating: 5 },
          { quote: "Real change, not band-aids.",      author: "S.P.", rating: 5 },
        ] } },
    ],
  },
  gallery: {
    label: "Gallery", description: "Show photos of the space, events, or work.",
    variants: [
      { id: "grid", label: "3-column grid", description: "Six equal-sized square images.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">The space</div>
          <div class="wf-grid-3" style="margin-top:5px">
            <div class="wf-image wf-image--square"></div><div class="wf-image wf-image--square"></div><div class="wf-image wf-image--square"></div>
            <div class="wf-image wf-image--square"></div><div class="wf-image wf-image--square"></div><div class="wf-image wf-image--square"></div>
          </div>
        </div>`,
        defaultContent: { title: "The space", images: [
          {src:"/logo.jpg",alt:""},{src:"/logo.jpg",alt:""},{src:"/logo.jpg",alt:""},
          {src:"/logo.jpg",alt:""},{src:"/logo.jpg",alt:""},{src:"/logo.jpg",alt:""},
        ] } },
      { id: "masonry", label: "Masonry", description: "Mixed heights, columns layout.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">Moments</div>
          <div class="wf-masonry" style="margin-top:5px">
            <div class="wf-image"></div>
            <div class="wf-image wf-image--tall"></div>
            <div class="wf-image"></div>
            <div class="wf-image wf-image--tall"></div>
            <div class="wf-image"></div>
            <div class="wf-image"></div>
          </div>
        </div>`,
        defaultContent: { title: "Moments", images: [
          {src:"/logo.jpg",alt:"",tall:false},{src:"/logo.jpg",alt:"",tall:true},{src:"/logo.jpg",alt:"",tall:false},
          {src:"/logo.jpg",alt:"",tall:true},{src:"/logo.jpg",alt:"",tall:false},{src:"/logo.jpg",alt:"",tall:false},
        ] } },
      { id: "band", label: "Photo band", description: "Full-width thin row of photos.",
        preview: `<div class="wf-section wf-section--flush">
          <div class="wf-band">
            <div class="wf-image"></div><div class="wf-image"></div><div class="wf-image"></div><div class="wf-image"></div>
          </div>
        </div>`,
        defaultContent: { images: [
          {src:"/logo.jpg",alt:""},{src:"/logo.jpg",alt:""},{src:"/logo.jpg",alt:""},{src:"/logo.jpg",alt:""},
        ] } },
      { id: "grid-4", label: "4-column grid", description: "Eight square tiles across four columns.",
        preview: `<div class="wf-section wf-center">
          <div class="wf-h2">The space</div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-top:5px">
            <div class="wf-image wf-image--square"></div><div class="wf-image wf-image--square"></div><div class="wf-image wf-image--square"></div><div class="wf-image wf-image--square"></div>
            <div class="wf-image wf-image--square"></div><div class="wf-image wf-image--square"></div><div class="wf-image wf-image--square"></div><div class="wf-image wf-image--square"></div>
          </div>
        </div>`,
        defaultContent: { title: "The space", images: Array.from({length: 8}, () => ({ src: "/logo.jpg", alt: "" })) } },
      { id: "mosaic", label: "1 big + 4 small", description: "Hero image with a 2×2 grid beside it.",
        preview: `<div class="wf-section">
          <div class="wf-h2 wf-center">Moments</div>
          <div style="display:grid;grid-template-columns:2fr 1fr;grid-template-rows:1fr 1fr;gap:3px;margin-top:5px;min-height:80px">
            <div class="wf-image" style="grid-row:1 / span 2;height:100%"></div>
            <div class="wf-image" style="height:100%"></div>
            <div class="wf-image" style="height:100%"></div>
          </div>
        </div>`,
        defaultContent: { title: "Moments", images: [
          { src: "/logo.jpg", alt: "Hero" },
          { src: "/logo.jpg", alt: "" }, { src: "/logo.jpg", alt: "" },
          { src: "/logo.jpg", alt: "" }, { src: "/logo.jpg", alt: "" },
        ] } },
      { id: "strip", label: "Horizontal strip", description: "Scrollable thin row of images.",
        preview: `<div class="wf-section wf-section--flush">
          <div style="display:flex;gap:2px;padding:5px 0">
            <div class="wf-image" style="flex:0 0 30%;aspect-ratio:4/3;border-radius:0"></div>
            <div class="wf-image" style="flex:0 0 30%;aspect-ratio:4/3;border-radius:0"></div>
            <div class="wf-image" style="flex:0 0 30%;aspect-ratio:4/3;border-radius:0"></div>
            <div class="wf-image" style="flex:0 0 30%;aspect-ratio:4/3;border-radius:0"></div>
          </div>
        </div>`,
        defaultContent: { images: Array.from({length: 6}, () => ({ src: "/logo.jpg", alt: "" })) } },
    ],
  },
  form: {
    label: "Contact form",
    description: "A form visitors can fill in. Submissions email you via Resend and land in Leads.",
    variants: [
      { id: "contact", label: "Simple contact", description: "Name, email, and a message. Great for general inquiries.",
        preview: `<div class="wf-section wf-center" style="padding:14px 12px;">
          <div class="wf-h2">Send us a message</div>
          <div class="wf-p">We'll reply within a day.</div>
          <div class="wf-card" style="text-align:left;margin-top:6px">
            <div class="wf-cred" style="opacity:0.6">Your name</div><div class="wf-input">John Smith</div>
            <div class="wf-cred" style="opacity:0.6;margin-top:4px">Email</div><div class="wf-input">you@example.com</div>
            <div class="wf-cred" style="opacity:0.6;margin-top:4px">Message</div><div class="wf-input" style="height:24px">…</div>
            <div class="wf-btn" style="width:100%;text-align:center;margin-top:5px">Send message</div>
          </div>
        </div>`,
        defaultContent: { eyebrow: "Contact", title: "Send us a message", description: "We'll reply within a day.", label_name: "Your name", label_email: "Email", label_message: "Message", cta_label: "Send message", thanks_message: "Thank you — we'll be in touch shortly.", form_name: "contact" } },
      { id: "booking", label: "Booking form", description: "Name, email, phone, preferred time, and a note.",
        preview: `<div class="wf-section wf-center" style="padding:14px 12px;">
          <div class="wf-h2">Book a free consultation</div>
          <div class="wf-p">15 minutes, no pressure.</div>
          <div class="wf-card" style="text-align:left;margin-top:6px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
              <div><div class="wf-cred" style="opacity:0.6">Name</div><div class="wf-input">Jane</div></div>
              <div><div class="wf-cred" style="opacity:0.6">Phone</div><div class="wf-input">647-…</div></div>
            </div>
            <div class="wf-cred" style="opacity:0.6;margin-top:4px">Email</div><div class="wf-input">you@example.com</div>
            <div class="wf-cred" style="opacity:0.6;margin-top:4px">When works?</div><div class="wf-input">Weekday evenings</div>
            <div class="wf-cred" style="opacity:0.6;margin-top:4px">Note</div><div class="wf-input" style="height:20px">…</div>
            <div class="wf-btn" style="width:100%;text-align:center;margin-top:5px">Request a booking</div>
          </div>
        </div>`,
        defaultContent: { eyebrow: "Book a session", title: "Book a free consultation", description: "15 minutes, no pressure — just a fit check.", label_name: "Your name", label_email: "Email", label_phone: "Phone", label_when: "What times work for you?", label_message: "Anything you'd like us to know", cta_label: "Request a booking", thanks_message: "Thank you — we'll be in touch shortly.", form_name: "booking" } },
      { id: "callback", label: "Callback strip", description: "Compact name + phone pill — we call them back.",
        preview: `<div class="wf-section wf-center" style="padding:16px 12px;">
          <div class="wf-h2">Prefer we call you?</div>
          <div class="wf-pill" style="margin-top:5px"><div style="display:flex;gap:4px;flex:1"><div class="wf-input" style="flex:1">Name</div><div class="wf-input" style="flex:1">Phone</div></div><span class="wf-btn wf-btn--sm">Call me</span></div>
        </div>`,
        defaultContent: { eyebrow: "Prefer a call?", title: "Request a callback", description: "Leave a number and we'll call you back — usually same day.", label_name: "Name", label_phone: "Phone", cta_label: "Call me", thanks_message: "Thank you — we'll call you shortly.", form_name: "callback" } },
    ],
  },
};

// -----------------------------------------------------------------
// Layout starter templates
// (used when creating a new page from the picker — Blank + 3 landing
// pages that stack real sections from the library so the wireframe
// previews look like the finished page)
// -----------------------------------------------------------------
// Helper — pluck a section's default content out of the library.
function def(cat, variantId) {
  const c = SECTION_LIBRARY[cat];
  const v = c && c.variants.find(x => x.id === variantId);
  return v ? JSON.parse(JSON.stringify(v.defaultContent)) : {};
}

// Layout starters — Blank first, then a spread of common page types.
// Each is a curated stack of sections from SECTION_LIBRARY so the
// wireframe preview cards paint what the finished page looks like.
export const LAYOUTS = {
  blank: {
    label: "Blank",
    description: "Start with a clean slate — add sections after.",
    sections: [],
  },
  home: {
    label: "Home",
    description: "Landing hero, stats, service cards, testimonials, dark CTA.",
    sections: [
      { type: "hero",        variant: "centered", content: def("hero",        "centered") },
      { type: "about",       variant: "stats",    content: def("about",       "stats") },
      { type: "services",    variant: "grid",     content: def("services",    "grid") },
      { type: "testimonial", variant: "cards",    content: def("testimonial", "cards") },
      { type: "cta",         variant: "dark",     content: def("cta",         "dark") },
    ],
  },
  about: {
    label: "About",
    description: "Split hero, founder card, timeline of steps, big quote, inline CTA.",
    sections: [
      { type: "hero",        variant: "split",    content: def("hero",        "split") },
      { type: "about",       variant: "founder",  content: def("about",       "founder") },
      { type: "steps",       variant: "vertical", content: def("steps",       "vertical") },
      { type: "testimonial", variant: "quote",    content: def("testimonial", "quote") },
      { type: "cta",         variant: "pill",     content: def("cta",         "pill") },
    ],
  },
  services: {
    label: "Services",
    description: "Minimal hero, feature comparison, long list, FAQ, split contact CTA.",
    sections: [
      { type: "hero",        variant: "minimal",   content: def("hero",        "minimal") },
      { type: "services",    variant: "features",  content: def("services",    "features") },
      { type: "services",    variant: "list",      content: def("services",    "list") },
      { type: "faq",         variant: "accordion", content: def("faq",         "accordion") },
      { type: "cta",         variant: "split",     content: def("cta",         "split") },
    ],
  },
  location: {
    label: "Location",
    description: "Minimal hero, two-column info + image, photo band, dark CTA.",
    sections: [
      { type: "hero",        variant: "minimal",   content: def("hero",        "minimal") },
      { type: "about",       variant: "two-col",   content: def("about",       "two-col") },
      { type: "gallery",     variant: "band",      content: def("gallery",     "band") },
      { type: "faq",         variant: "two-col",   content: def("faq",         "two-col") },
      { type: "cta",         variant: "dark",      content: def("cta",         "dark") },
    ],
  },
  gallery: {
    label: "Gallery",
    description: "Minimal hero, image grid, masonry, quote wall, pill CTA.",
    sections: [
      { type: "hero",        variant: "minimal",   content: def("hero",        "minimal") },
      { type: "gallery",     variant: "grid",      content: def("gallery",     "grid") },
      { type: "gallery",     variant: "masonry",   content: def("gallery",     "masonry") },
      { type: "testimonial", variant: "row",       content: def("testimonial", "row") },
      { type: "cta",         variant: "pill",      content: def("cta",         "pill") },
    ],
  },
  faq: {
    label: "FAQ",
    description: "Minimal hero, accordion, compact card grid, split contact CTA.",
    sections: [
      { type: "hero",        variant: "minimal",   content: def("hero",        "minimal") },
      { type: "faq",         variant: "accordion", content: def("faq",         "accordion") },
      { type: "faq",         variant: "cards",     content: def("faq",         "cards") },
      { type: "cta",         variant: "split",     content: def("cta",         "split") },
    ],
  },
  contact: {
    label: "Contact",
    description: "Split hero, contact CTA with form, quick-answer FAQ, photo band.",
    sections: [
      { type: "hero",        variant: "split",     content: def("hero",        "split") },
      { type: "cta",         variant: "split",     content: def("cta",         "split") },
      { type: "faq",         variant: "cards",     content: def("faq",         "cards") },
      { type: "gallery",     variant: "band",      content: def("gallery",     "band") },
    ],
  },
  team: {
    label: "Team",
    description: "Minimal hero, founder card, three feature columns, testimonials, CTA.",
    sections: [
      { type: "hero",        variant: "minimal",   content: def("hero",        "minimal") },
      { type: "about",       variant: "founder",   content: def("about",       "founder") },
      { type: "services",    variant: "features",  content: def("services",    "features") },
      { type: "testimonial", variant: "cards",     content: def("testimonial", "cards") },
      { type: "cta",         variant: "pill",      content: def("cta",         "pill") },
    ],
  },
  pricing: {
    label: "Pricing",
    description: "Minimal hero, three-column feature comparison, FAQ, quote row, dark CTA.",
    sections: [
      { type: "hero",        variant: "minimal",   content: def("hero",        "minimal") },
      { type: "services",    variant: "features",  content: def("services",    "features") },
      { type: "faq",         variant: "accordion", content: def("faq",         "accordion") },
      { type: "testimonial", variant: "row",       content: def("testimonial", "row") },
      { type: "cta",         variant: "dark",      content: def("cta",         "dark") },
    ],
  },
  testimonials: {
    label: "Testimonials",
    description: "Minimal hero, big quote, three review cards, quote wall, pill CTA.",
    sections: [
      { type: "hero",        variant: "minimal",   content: def("hero",        "minimal") },
      { type: "testimonial", variant: "quote",     content: def("testimonial", "quote") },
      { type: "testimonial", variant: "cards",     content: def("testimonial", "cards") },
      { type: "testimonial", variant: "row",       content: def("testimonial", "row") },
      { type: "cta",         variant: "pill",      content: def("cta",         "pill") },
    ],
  },
};
