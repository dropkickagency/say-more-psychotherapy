// Server-side HTML for user-authored dynamic pages.
//
// Phase 1 goals:
//   - Match the site's existing styling (styles.css, fonts, colours)
//   - Render each section from a small starter registry (hero, text-block,
//     image-with-text, cta) so the 3 non-blank layouts have real content
//   - Ship the same header/footer as the static pages so nav, footer,
//     script.js all "just work" — the same runtime patcher and nav
//     injector will run here too
//
// Phase 2 will grow the section registry to 24 templates across 8
// categories. The switch in `renderSection` is the extension point.

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ------- Section templates (Phase 1 starter set) -------

function renderHero(c) {
  return `
  <section class="hero" style="min-height: 60vh;">
    <div class="wrap hero__inner">
      <div class="hero__text">
        ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
        <h1>${esc(c.title || "New page")}</h1>
        ${c.subtitle ? `<p class="lead">${esc(c.subtitle)}</p>` : ""}
        ${c.cta_label ? `<div class="hero__cta"><a class="btn btn--primary" href="${esc(c.cta_href || "consultation")}">${esc(c.cta_label)}</a></div>` : ""}
      </div>
    </div>
  </section>`;
}

function renderTextBlock(c) {
  return `
  <section class="section">
    <div class="wrap" style="max-width: 780px;">
      ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
      ${c.title ? `<h2>${esc(c.title)}</h2>` : ""}
      ${c.body ? `<p class="lead" style="white-space: pre-wrap;">${esc(c.body)}</p>` : ""}
    </div>
  </section>`;
}

function renderImageWithText(c) {
  return `
  <section class="section" style="background: var(--color-surface);">
    <div class="wrap therapist-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2xl); align-items: center;">
      <div class="img-box" style="aspect-ratio: 4/5;">
        <img src="${esc(c.image || "logo.jpg")}" alt="${esc(c.image_alt || "")}" loading="lazy" />
      </div>
      <div>
        ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
        ${c.title ? `<h2>${esc(c.title)}</h2>` : ""}
        ${c.body ? `<p class="lead" style="white-space: pre-wrap;">${esc(c.body)}</p>` : ""}
      </div>
    </div>
  </section>`;
}

function renderCta(c) {
  return `
  <section class="cta" style="background-image: url('${esc(c.image || "cta%202.png")}');">
    <div class="wrap cta__inner" style="text-align: center; position: relative; z-index: 1;">
      ${c.eyebrow ? `<span class="eyebrow">${esc(c.eyebrow)}</span>` : ""}
      <h2>${esc(c.title || "Take the first step")}</h2>
      ${c.subtitle ? `<p class="lead">${esc(c.subtitle)}</p>` : ""}
      <div style="margin-top: var(--space-lg);">
        <a class="btn btn--primary" href="${esc(c.cta_href || "consultation")}">${esc(c.cta_label || "Book a free consultation")}</a>
      </div>
    </div>
  </section>`;
}

function renderSection(s) {
  if (!s || typeof s !== "object") return "";
  switch (s.type) {
    case "hero":            return renderHero(s.content || {});
    case "text-block":      return renderTextBlock(s.content || {});
    case "image-with-text": return renderImageWithText(s.content || {});
    case "cta":             return renderCta(s.content || {});
    default:                return `<!-- unknown section: ${esc(s.type)} -->`;
  }
}

// ------- Full-page shell -------

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
      <a href="/" class="brand" aria-label="Say More Psychotherapy — home">
        <img src="/logo.jpg" alt="Say More Psychotherapy" />
      </a>
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
        <a href="tel:+16479150231" class="nav__phone">
          <span class="emo emo--sm">📞</span>
          (647) 915-0231
        </a>
        <a href="/consultation" class="btn btn--primary">Get Free Session</a>
      </div>
      <button class="nav__toggle" id="navToggle" aria-label="Open menu" aria-expanded="false" aria-controls="navMobile">
        <span class="emo emo--lg">☰</span>
      </button>
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
      <div class="foot__brand">
        <img src="/logo.jpg" alt="" />
        <p><strong>Say More Psychotherapy</strong><br><small>Paras Geramian, RP (Qualifying)</small></p>
      </div>
      <div class="foot__links">
        <a href="/about">About</a>
        <a href="/services">Services</a>
        <a href="/location">Location</a>
        <a href="/blog">Blog</a>
        <a href="/consultation">Book</a>
      </div>
      <div class="foot__contact">
        <a href="tel:+16479150231">(647) 915-0231</a>
        <a href="mailto:info@saymorepsychotherapy.ca">info@saymorepsychotherapy.ca</a>
      </div>
    </div>
    <div class="wrap foot__legal"><small>© <span id="footYear"></span> Say More Psychotherapy. All rights reserved.</small></div>
  </footer>
  <script>document.getElementById('footYear').textContent = new Date().getFullYear();</script>
  <script src="/script.js?v=2"></script>`;
}

export function renderPageHtml(page) {
  const sections = Array.isArray(page.sections) ? page.sections : [];
  const body = sections.map(renderSection).join("\n");
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

// ------- Layout starter templates (used when creating a new page) -------
// Phase 1 uses these to pre-fill `sections` — Phase 2 will let the user
// pick any section from the full library and build from scratch.
export const LAYOUTS = {
  blank: {
    label: "Blank",
    description: "Start with a clean slate.",
    sections: [],
  },
  landing: {
    label: "Landing",
    description: "Hero, short value prop, and a call to action.",
    sections: [
      { type: "hero", variant: 1, content: {
        eyebrow: "New page",
        title: "Say what you couldn't say.",
        subtitle: "A short, welcoming line about what this page is about.",
        cta_label: "Book a free session",
        cta_href: "/consultation",
      }},
      { type: "text-block", variant: 1, content: {
        eyebrow: "About this",
        title: "Two paragraphs about what you offer.",
        body: "Replace this text with your own. It supports line breaks and keeps the same warm typography as the rest of the site.\n\nA second paragraph can go here too — click the text in the editor to change it.",
      }},
      { type: "cta", variant: 1, content: {
        eyebrow: "Ready when you are",
        title: "Book a free 15-minute consultation",
        subtitle: "No pressure. Just a conversation to see if we're a good fit.",
        cta_label: "Get started",
        cta_href: "/consultation",
      }},
    ],
  },
  content: {
    label: "Long-form content",
    description: "Hero followed by a longer body of text and a CTA.",
    sections: [
      { type: "hero", variant: 1, content: {
        eyebrow: "New page",
        title: "A longer read for a specific topic.",
      }},
      { type: "text-block", variant: 1, content: {
        eyebrow: "Overview",
        title: "The story or explanation",
        body: "Use this template for pages that need room for a longer explanation — an approach, a philosophy, a policy, a resource.\n\nClick any text in the editor to change it.",
      }},
      { type: "cta", variant: 1, content: {
        title: "Have questions?",
        subtitle: "Book a free 15-minute consultation and we'll talk it through.",
        cta_label: "Book a consultation",
        cta_href: "/consultation",
      }},
    ],
  },
  split: {
    label: "Image + text",
    description: "Hero, an image-with-text section, and a CTA.",
    sections: [
      { type: "hero", variant: 1, content: {
        eyebrow: "New page",
        title: "A page that leads with an image.",
      }},
      { type: "image-with-text", variant: 1, content: {
        eyebrow: "About",
        title: "Two-column story",
        body: "Click the image to replace it, and click the text to edit it. This layout works well for team bios, service explainers, and short case studies.",
        image: "/logo.jpg",
        image_alt: "Descriptive alt text",
      }},
      { type: "cta", variant: 1, content: {
        title: "Let's talk",
        cta_label: "Book a free session",
        cta_href: "/consultation",
      }},
    ],
  },
};
