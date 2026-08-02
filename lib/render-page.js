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
  return `<section class="section" style="text-align: center;">
    <div class="wrap" style="max-width: 820px;">
      ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
      <h2>${esc(c.title || "About")}</h2>
      ${c.body ? `<p class="lead">${esc(c.body)}</p>` : ""}
      ${stats.length ? `<div style="display: grid; grid-template-columns: repeat(${Math.min(stats.length, 3)}, 1fr); gap: var(--space-lg); margin-top: var(--space-xl);">
        ${stats.map(s => `<div>
          <div style="font-family: 'Cormorant Garamond', serif; font-size: 44px; color: var(--color-brand); font-weight: 500;">${esc(s.value || "")}</div>
          <div style="font-size: 13px; color: var(--color-muted); margin-top: 4px;">${esc(s.label || "")}</div>
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
        ${items.map(it => `<details style="background: #fff; border: 1px solid var(--color-border); border-radius: 12px; padding: 18px 22px;">
          <summary style="cursor: pointer; font-family: 'Manrope', sans-serif; font-weight: 600; font-size: 15.5px; color: var(--color-ink); list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
            <span>${esc(it.q || "Question?")}</span><span style="color: var(--color-brand); font-size: 18px;">⌄</span>
          </summary>
          <div style="margin-top: 12px; color: var(--color-muted); font-size: 15px; line-height: 1.65; white-space: pre-wrap;">${esc(it.a || "")}</div>
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
  return `<section class="section" style="text-align: center;">
    <div class="wrap" style="max-width: 760px;">
      <div style="font-family: 'Cormorant Garamond', serif; font-size: 80px; color: var(--color-brand); line-height: 1;">"</div>
      <p style="font-family: 'Cormorant Garamond', serif; font-size: 26px; line-height: 1.5; color: var(--color-ink); font-style: italic; margin: 0;">${esc(c.quote || "Their care changed everything for me.")}</p>
      <div style="margin-top: var(--space-md); font-family: 'Manrope', sans-serif; font-weight: 600; color: var(--color-ink);">${esc(c.author || "Anonymous")}</div>
      ${c.role ? `<div style="color: var(--color-muted); font-size: 13.5px;">${esc(c.role)}</div>` : ""}
    </div>
  </section>`;
}
function testimonialCards(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section" style="background: var(--color-surface);">
    <div class="wrap">
      ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-lg);">
        ${items.map(it => `<div style="background: #fff; padding: var(--space-lg); border-radius: 16px; border: 1px solid var(--color-border);">
          <div style="color: var(--color-brand); margin-bottom: 6px;">${"★".repeat(Math.max(1, Math.min(5, Number(it.rating) || 5)))}</div>
          <p style="font-family: 'Cormorant Garamond', serif; font-size: 18px; line-height: 1.55; font-style: italic; margin: 0;">"${esc(it.quote || "")}"</p>
          <div style="margin-top: var(--space-sm); font-family: 'Manrope', sans-serif; font-weight: 600; font-size: 14px;">${esc(it.author || "Anonymous")}</div>
          ${it.role ? `<div style="color: var(--color-muted); font-size: 12.5px;">${esc(it.role)}</div>` : ""}
        </div>`).join("")}
      </div>
    </div>
  </section>`;
}
function testimonialRow(c) {
  const items = Array.isArray(c.items) ? c.items : [];
  return `<section class="section">
    <div class="wrap">
      ${c.title ? `<h2 style="text-align: center; margin-bottom: var(--space-xl);">${esc(c.title)}</h2>` : ""}
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-md);">
        ${items.map(it => `<div style="padding: var(--space-md); border-left: 3px solid var(--color-brand);">
          <p style="font-family: 'Cormorant Garamond', serif; font-size: 17px; font-style: italic; line-height: 1.55; margin: 0;">"${esc(it.quote || "")}"</p>
          <div style="margin-top: 10px; font-family: 'Manrope', sans-serif; font-weight: 600; font-size: 13px;">— ${esc(it.author || "Anonymous")}</div>
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

// -----------------------------------------------------------------
// Shell HTML
// -----------------------------------------------------------------

function shellHead(title, description) {
  const safeTitle = esc(title || "Say More Psychotherapy");
  const safeDesc = esc(description || "Compassionate, relational talk therapy in Brampton and across Ontario.");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} — Say More Psychotherapy</title>
  <meta name="description" content="${safeDesc}" />
  <link rel="icon" type="image/jpeg" href="/logo.jpg" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,400;1,400;1,500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css?v=2" />
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
  return `
  <footer class="foot">
    <div class="wrap foot__inner">
      <div class="foot__brand"><img src="/logo.jpg" alt="" /><p><strong>Say More Psychotherapy</strong><br><small>Paras Geramian, RP (Qualifying)</small></p></div>
      <div class="foot__links"><a href="/about">About</a><a href="/services">Services</a><a href="/location">Location</a><a href="/blog">Blog</a><a href="/consultation">Book</a></div>
      <div class="foot__contact"><a href="tel:+16479150231">(647) 915-0231</a><a href="mailto:info@saymorepsychotherapy.ca">info@saymorepsychotherapy.ca</a></div>
    </div>
    <div class="wrap foot__legal"><small>© <span id="footYear"></span> Say More Psychotherapy. All rights reserved.</small></div>
  </footer>
  <script>document.getElementById('footYear').textContent = new Date().getFullYear();</script>
  <script>window.__SM_DYNAMIC_PAGE__ = true;</script>
  <script src="/script.js?v=2"></script>`;
}

export function renderPageHtml(page) {
  const sections = Array.isArray(page.sections) ? page.sections : [];
  const body = sections.map(renderSection).join("\n") ||
    `<section class="section" style="text-align: center; padding: var(--space-3xl) 0;"><div class="wrap"><p class="lead" style="color: var(--color-muted);">This page is empty. Add sections from the website editor.</p></div></section>`;
  return `${shellHead(page.title, page.meta_description)}
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
  return `${shellHead("Page not found", "Page not found")}
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
// wireframe: array of block descriptors ({ h: rem/px height, kind: color })
// -----------------------------------------------------------------
export const SECTION_LIBRARY = {
  hero: {
    label: "Hero",
    description: "The top of a page — big intro line.",
    variants: [
      { id: "centered", label: "Centered", description: "Big centered title with a CTA button.",
        wire: [ {h:12,c:"eyebrow"}, {h:34,c:"title"}, {h:16,c:"text"}, {h:22,c:"button"} ],
        defaultContent: { eyebrow: "Welcome", title: "Say what you couldn't say.", subtitle: "A short line that welcomes the visitor.", cta_label: "Book a free session", cta_href: "/consultation" } },
      { id: "split", label: "Split", description: "Text on the left, image on the right.",
        wire: [ {h:80,c:"split"} ],
        defaultContent: { eyebrow: "Welcome", title: "Say what you couldn't say.", subtitle: "A short welcoming line.", cta_label: "Book a free session", cta_href: "/consultation", image: "/logo.jpg" } },
      { id: "minimal", label: "Minimal", description: "Small eyebrow + title, nothing else.",
        wire: [ {h:12,c:"eyebrow"}, {h:34,c:"title"} ],
        defaultContent: { eyebrow: "New page", title: "A quiet page." } },
    ],
  },
  about: {
    label: "About",
    description: "Introduce yourself, your work, or your team.",
    variants: [
      { id: "two-col", label: "Two-column", description: "Text on one side, image on the other.",
        wire: [ {h:80,c:"split"} ],
        defaultContent: { eyebrow: "About", title: "Two-column story", body: "Replace this with a warm introduction — a few sentences about who this is for and what the experience is like.", image: "/logo.jpg" } },
      { id: "founder", label: "Founder card", description: "Portrait, bio, and a credentials list.",
        wire: [ {h:22,c:"image"}, {h:14,c:"title"}, {h:12,c:"text"}, {h:12,c:"text"}, {h:8,c:"chip"}, {h:8,c:"chip"} ],
        defaultContent: { eyebrow: "About the therapist", title: "Paras Geramian, RP (Qualifying)", body: "A short bio in your own voice.", credentials: ["Registered Psychotherapist (Qualifying)", "M.A. Counselling Psychology", "Member, CRPO"], image: "/logo.jpg" } },
      { id: "stats", label: "Intro + stats", description: "Short intro followed by a row of stats.",
        wire: [ {h:12,c:"eyebrow"}, {h:22,c:"title"}, {h:14,c:"text"}, {h:36,c:"stats"} ],
        defaultContent: { eyebrow: "About", title: "Why we do this work", body: "One or two sentences that summarise your approach.", stats: [{value:"5+", label:"Years in practice"}, {value:"200+", label:"Clients supported"}, {value:"100%", label:"Confidential"}] } },
    ],
  },
  services: {
    label: "Services",
    description: "Show what you offer.",
    variants: [
      { id: "grid", label: "Card grid", description: "Three service cards with images.",
        wire: [ {h:14,c:"title"}, {h:56,c:"grid3"} ],
        defaultContent: { title: "What we offer", items: [
          { title: "Anxiety Therapy", description: "For the racing thoughts, the tight chest.", image: "/logo.jpg", cta_label: "Learn more", cta_href: "/anxiety-therapy" },
          { title: "Depression Counselling", description: "Gentle, steady work.", image: "/logo.jpg", cta_label: "Learn more", cta_href: "/depression-counselling" },
          { title: "Couples Therapy", description: "For two people ready to be heard.", image: "/logo.jpg", cta_label: "Learn more", cta_href: "/couples-therapy" },
        ] } },
      { id: "list", label: "Long list", description: "Row-per-service, quiet and text-forward.",
        wire: [ {h:14,c:"title"}, {h:14,c:"row"}, {h:14,c:"row"}, {h:14,c:"row"}, {h:14,c:"row"} ],
        defaultContent: { title: "Services", items: [
          { title: "Anxiety Therapy", description: "Practical tools + relational support.", cta_label: "Learn more", cta_href: "/anxiety-therapy" },
          { title: "Depression Counselling", description: "For the heaviness that hasn't lifted.", cta_label: "Learn more", cta_href: "/depression-counselling" },
          { title: "Couples Therapy", description: "For repair and re-connection.", cta_label: "Learn more", cta_href: "/couples-therapy" },
          { title: "Parenting", description: "For the impossible-feeling seasons.", cta_label: "Learn more", cta_href: "/parenting" },
        ] } },
      { id: "features", label: "Feature comparison", description: "Three feature columns with bullet points.",
        wire: [ {h:14,c:"title"}, {h:60,c:"grid3"} ],
        defaultContent: { title: "How we work", items: [
          { title: "In person", bullets: ["Brampton office", "Private, warm space", "Evening slots available"] },
          { title: "Virtually", bullets: ["Ontario-wide", "Secure video", "Same fees"] },
          { title: "Sliding scale", bullets: ["Ask about availability", "No paperwork required", "Confidential"] },
        ] } },
    ],
  },
  faq: {
    label: "FAQ",
    description: "Answer common questions.",
    variants: [
      { id: "accordion", label: "Accordion", description: "Click-to-expand questions.",
        wire: [ {h:14,c:"title"}, {h:14,c:"row"}, {h:14,c:"row"}, {h:14,c:"row"}, {h:14,c:"row"}, {h:14,c:"row"} ],
        defaultContent: { title: "Common questions", items: [
          { q: "How long is a session?", a: "50 minutes, weekly or bi-weekly." },
          { q: "How much does it cost?", a: "$150 per session. Insurance and receipts available." },
          { q: "Do you see couples?", a: "Yes — couples work is one of our specialties." },
          { q: "Where are you located?", a: "In Brampton, and virtually across Ontario." },
          { q: "How do I book?", a: "Send us a message and we'll set up a free 15-minute intro call." },
        ] } },
      { id: "two-col", label: "Two-column grid", description: "Grid of Q&A pairs.",
        wire: [ {h:14,c:"title"}, {h:60,c:"grid2"} ],
        defaultContent: { title: "Questions", items: [
          { q: "How long is a session?", a: "50 minutes." },
          { q: "How much?", a: "$150 per session." },
          { q: "Insurance?", a: "Yes — receipts available." },
          { q: "Booking?", a: "Free 15-min intro first." },
        ] } },
      { id: "cards", label: "Compact cards", description: "Small card grid, six questions.",
        wire: [ {h:14,c:"title"}, {h:48,c:"grid3"} ],
        defaultContent: { title: "Quick answers", items: [
          { q: "How long?", a: "50 minutes." },
          { q: "How much?", a: "$150." },
          { q: "Where?", a: "Brampton + virtual." },
          { q: "Insurance?", a: "Receipts provided." },
          { q: "Couples?", a: "Yes." },
          { q: "First step?", a: "Free intro call." },
        ] } },
    ],
  },
  cta: {
    label: "Call to action",
    description: "Ask visitors to take the next step.",
    variants: [
      { id: "dark", label: "Full-width banner", description: "Dark image background, centered CTA.",
        wire: [ {h:80,c:"dark"} ],
        defaultContent: { eyebrow: "Ready when you are", title: "Book a free 15-minute consultation", subtitle: "No pressure. Just a conversation.", cta_label: "Get started", cta_href: "/consultation" } },
      { id: "split", label: "Text + form", description: "Copy on the left, contact form on the right.",
        wire: [ {h:80,c:"split"} ],
        defaultContent: { eyebrow: "Reach out", title: "Let's start with a conversation", subtitle: "A free 15-minute consultation to see if we're a good fit.", form_title: "Book a free consultation", cta_label: "Send", cta_href: "/consultation" } },
      { id: "pill", label: "Pill", description: "Small inline callout with a button.",
        wire: [ {h:20,c:"pill"} ],
        defaultContent: { title: "Have questions? Let's talk.", cta_label: "Book a call", cta_href: "/consultation" } },
    ],
  },
  steps: {
    label: "How it works",
    description: "Explain a numbered process.",
    variants: [
      { id: "vertical", label: "Numbered vertical", description: "1-2-3 stacked, each with a description.",
        wire: [ {h:14,c:"title"}, {h:20,c:"row"}, {h:20,c:"row"}, {h:20,c:"row"} ],
        defaultContent: { title: "How it works", items: [
          { title: "Reach out", description: "Send a message or book a free 15-min intro." },
          { title: "Meet", description: "We chat, see if it's a good fit, and pick a time." },
          { title: "Begin", description: "Weekly or bi-weekly sessions, in person or online." },
        ] } },
      { id: "horizontal", label: "Horizontal row", description: "Three columns side-by-side.",
        wire: [ {h:14,c:"title"}, {h:44,c:"grid3"} ],
        defaultContent: { title: "The process", items: [
          { title: "Reach out", description: "Send us a message." },
          { title: "Meet", description: "Free 15-min intro." },
          { title: "Begin", description: "Weekly sessions." },
        ] } },
      { id: "timeline", label: "Timeline", description: "Dots connected by a line.",
        wire: [ {h:14,c:"title"}, {h:40,c:"timeline"} ],
        defaultContent: { title: "What to expect", items: [
          { title: "Message", description: "Same-week reply." },
          { title: "Intro call", description: "15 free minutes." },
          { title: "First session", description: "Within 1–2 weeks." },
          { title: "Ongoing", description: "At your pace." },
        ] } },
    ],
  },
  testimonial: {
    label: "Testimonials",
    description: "Share what people have said.",
    variants: [
      { id: "quote", label: "Single big quote", description: "One large centered quote.",
        wire: [ {h:60,c:"quote"} ],
        defaultContent: { quote: "Their care changed everything for me.", author: "Anonymous client", role: "" } },
      { id: "cards", label: "Three cards", description: "Three testimonial cards with ratings.",
        wire: [ {h:14,c:"title"}, {h:52,c:"grid3"} ],
        defaultContent: { title: "What people say", items: [
          { quote: "I felt heard for the first time.", author: "A.M.", role: "Anxiety client", rating: 5 },
          { quote: "This work changed how I show up.", author: "R.K.", role: "Couples work", rating: 5 },
          { quote: "Warm, patient, real.", author: "S.P.", role: "Parenting support", rating: 5 },
        ] } },
      { id: "row", label: "Quote wall", description: "A row of shorter quotes.",
        wire: [ {h:14,c:"title"}, {h:44,c:"row-quotes"} ],
        defaultContent: { title: "In their own words", items: [
          { quote: "I finally felt heard.", author: "A.M." },
          { quote: "Warm and grounded.", author: "R.K." },
          { quote: "The best decision I made this year.", author: "S.P." },
          { quote: "A safe place to think.", author: "J.T." },
          { quote: "Real change, not band-aids.", author: "L.B." },
        ] } },
    ],
  },
  gallery: {
    label: "Gallery",
    description: "Show photos of the space, events, or work.",
    variants: [
      { id: "grid", label: "3-column grid", description: "Six equal-sized square images.",
        wire: [ {h:14,c:"title"}, {h:60,c:"grid3"} ],
        defaultContent: { title: "The space", images: [
          {src:"/logo.jpg",alt:""},{src:"/logo.jpg",alt:""},{src:"/logo.jpg",alt:""},
          {src:"/logo.jpg",alt:""},{src:"/logo.jpg",alt:""},{src:"/logo.jpg",alt:""},
        ] } },
      { id: "masonry", label: "Masonry", description: "Mixed heights, columns layout.",
        wire: [ {h:14,c:"title"}, {h:60,c:"masonry"} ],
        defaultContent: { title: "Moments", images: [
          {src:"/logo.jpg",alt:"",tall:false},{src:"/logo.jpg",alt:"",tall:true},{src:"/logo.jpg",alt:"",tall:false},
          {src:"/logo.jpg",alt:"",tall:true},{src:"/logo.jpg",alt:"",tall:false},{src:"/logo.jpg",alt:"",tall:false},
        ] } },
      { id: "band", label: "Photo band", description: "Full-width thin row of photos.",
        wire: [ {h:30,c:"band"} ],
        defaultContent: { images: [
          {src:"/logo.jpg",alt:""},{src:"/logo.jpg",alt:""},{src:"/logo.jpg",alt:""},{src:"/logo.jpg",alt:""},
        ] } },
    ],
  },
};

// -----------------------------------------------------------------
// Layout starter templates
// (used when creating a new page from the 4-option picker)
// -----------------------------------------------------------------
export const LAYOUTS = {
  blank: {
    label: "Blank",
    description: "Start with a clean slate — add sections after.",
    sections: [],
  },
  landing: {
    label: "Landing",
    description: "Hero, short value prop, and a call to action.",
    sections: [
      { type: "hero", variant: "centered", content: SECTION_LIBRARY.hero.variants[0].defaultContent },
      { type: "about", variant: "two-col", content: SECTION_LIBRARY.about.variants[0].defaultContent },
      { type: "cta",  variant: "dark", content: SECTION_LIBRARY.cta.variants[0].defaultContent },
    ],
  },
  content: {
    label: "Long-form content",
    description: "Hero, long body of text, and a CTA.",
    sections: [
      { type: "hero", variant: "minimal", content: SECTION_LIBRARY.hero.variants[2].defaultContent },
      { type: "text-block", content: { eyebrow: "Overview", title: "The story or explanation", body: "Use this for a longer explanation — an approach, a philosophy, a policy. Click any text to change it." } },
      { type: "cta",  variant: "pill", content: SECTION_LIBRARY.cta.variants[2].defaultContent },
    ],
  },
  split: {
    label: "Image + text",
    description: "Hero, image-with-text, and a CTA.",
    sections: [
      { type: "hero", variant: "split", content: SECTION_LIBRARY.hero.variants[1].defaultContent },
      { type: "about", variant: "two-col", content: SECTION_LIBRARY.about.variants[0].defaultContent },
      { type: "cta",  variant: "dark", content: SECTION_LIBRARY.cta.variants[0].defaultContent },
    ],
  },
};
