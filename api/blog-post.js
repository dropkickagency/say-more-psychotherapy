import { sql, ensureSchema } from "../lib/db.js";

const SITE_URL = "https://www.saymorepsychotherapy.ca";

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(s) {
  return escapeHtml(s);
}

// Minimal markdown → HTML. Kept small on purpose — full featured enough
// for a therapist writing prose, without pulling in a dependency.
function renderMarkdown(md) {
  if (!md) return "";
  const src = String(md).replace(/\r\n/g, "\n").trim();

  // Split by blank lines into blocks.
  const blocks = src.split(/\n{2,}/);
  const out = [];

  for (let block of blocks) {
    block = block.trim();
    if (!block) continue;

    // Headings
    let m;
    if ((m = block.match(/^######\s+(.+)$/))) { out.push(`<h6>${inline(m[1])}</h6>`); continue; }
    if ((m = block.match(/^#####\s+(.+)$/)))  { out.push(`<h5>${inline(m[1])}</h5>`); continue; }
    if ((m = block.match(/^####\s+(.+)$/)))   { out.push(`<h4>${inline(m[1])}</h4>`); continue; }
    if ((m = block.match(/^###\s+(.+)$/)))    { out.push(`<h3>${inline(m[1])}</h3>`); continue; }
    if ((m = block.match(/^##\s+(.+)$/)))     { out.push(`<h2>${inline(m[1])}</h2>`); continue; }
    if ((m = block.match(/^#\s+(.+)$/)))      { out.push(`<h2>${inline(m[1])}</h2>`); continue; }

    // Blockquote
    if (/^>\s?/.test(block)) {
      const body = block.split("\n").map(l => l.replace(/^>\s?/, "")).join(" ");
      out.push(`<blockquote>${inline(body)}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^([-*])\s+/.test(block)) {
      const items = block.split("\n").filter(Boolean).map(l => l.replace(/^([-*])\s+/, "")).map(inline);
      out.push(`<ul>${items.map(i => `<li>${i}</li>`).join("")}</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(block)) {
      const items = block.split("\n").filter(Boolean).map(l => l.replace(/^\d+\.\s+/, "")).map(inline);
      out.push(`<ol>${items.map(i => `<li>${i}</li>`).join("")}</ol>`);
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(block)) { out.push("<hr>"); continue; }

    // Raw HTML block passthrough (if a line starts with a block-level tag)
    if (/^<(p|div|section|article|figure|img|table|iframe|blockquote|h[1-6]|ul|ol)\b/i.test(block)) {
      out.push(block);
      continue;
    }

    // Paragraph
    out.push(`<p>${inline(block).replace(/\n/g, "<br>")}</p>`);
  }

  return out.join("\n");
}

function inline(s) {
  // Escape first, then apply markdown patterns
  let x = escapeHtml(s);
  // Links [text](url)
  x = x.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, t, u) => {
    return `<a href="${u}" rel="noopener" target="_blank">${t}</a>`;
  });
  // Bold **x** and __x__
  x = x.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  x = x.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  // Italic *x* and _x_
  x = x.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");
  x = x.replace(/(^|[^_])_([^_]+)_(?!_)/g, "$1<em>$2</em>");
  // Inline code `x`
  x = x.replace(/`([^`]+)`/g, "<code>$1</code>");
  return x;
}

function renderBody(body, format) {
  if (!body) return "";
  if (format === "html") return body; // trust — author is admin
  return renderMarkdown(body);
}

function fmtDate(d) {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function isoDate(d) {
  if (!d) return "";
  return new Date(d).toISOString();
}

function buildHtml(post) {
  const title = post.title || "Blog";
  const desc =
    post.meta_description ||
    post.excerpt ||
    (post.body ? String(post.body).replace(/[#*_>`\-]/g, "").slice(0, 155).trim() + "…" : "Notes from Say More Psychotherapy.");
  const url = `${SITE_URL}/blog/${post.slug}`;
  const canonical = post.canonical_url || url;
  const image = post.og_image || post.cover_image || `${SITE_URL}/main%20hero%20image.png`;
  const author = post.author || "Paras Geramian, RP (Qualifying)";
  const keywords = post.keywords || "";
  const bodyHtml = renderBody(post.body, post.body_format);
  const dtPublished = isoDate(post.published_at);
  const dtModified = isoDate(post.updated_at || post.published_at);
  const dtHuman = fmtDate(post.published_at);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "mainEntityOfPage": { "@type": "WebPage", "@id": url },
    "headline": title,
    "description": desc,
    "image": image,
    "author": {
      "@type": "Person",
      "name": author,
      "url": `${SITE_URL}/about.html`,
    },
    "publisher": {
      "@type": "Organization",
      "name": "Say More Psychotherapy",
      "logo": {
        "@type": "ImageObject",
        "url": `${SITE_URL}/logo.jpg`,
      },
    },
    "datePublished": dtPublished,
    "dateModified": dtModified,
  };

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — Say More Psychotherapy</title>
  <meta name="description" content="${escapeAttr(desc)}" />
  ${keywords ? `<meta name="keywords" content="${escapeAttr(keywords)}" />` : ""}
  <link rel="canonical" href="${escapeAttr(canonical)}" />
  <meta name="author" content="${escapeAttr(author)}" />
  <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />

  <link rel="icon" type="image/jpeg" href="/logo.jpg" />
  <link rel="apple-touch-icon" href="/logo.jpg" />

  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Say More Psychotherapy" />
  <meta property="og:title" content="${escapeAttr(title)}" />
  <meta property="og:description" content="${escapeAttr(desc)}" />
  <meta property="og:url" content="${escapeAttr(url)}" />
  <meta property="og:image" content="${escapeAttr(image)}" />
  <meta property="article:published_time" content="${dtPublished}" />
  <meta property="article:modified_time" content="${dtModified}" />
  <meta property="article:author" content="${escapeAttr(author)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(title)}" />
  <meta name="twitter:description" content="${escapeAttr(desc)}" />
  <meta name="twitter:image" content="${escapeAttr(image)}" />

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&family=Inter:wght@400;500&family=Cormorant+Garamond:ital,wght@0,400;1,400;1,500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css">

  <!-- Meta Pixel Code -->
  <script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version="2.0";
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,"script",
  "https://connect.facebook.net/en_US/fbevents.js");
  fbq("init", "2038141506794025");
  fbq("track", "PageView");
  </script>
  <noscript><img height="1" width="1" style="display:none"
  src="https://www.facebook.com/tr?id=2038141506794025&ev=PageView&noscript=1"
  /></noscript>

  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
</head>
<body>

  <div class="promo">
    <div class="promo__inner">
      <span><span class="emo emo--sm">🌿</span> Get a free session now!</span>
      <a href="/consultation.html">Click Here</a>
    </div>
  </div>

  <header class="nav">
    <div class="wrap nav__inner">
      <a href="/index.html" class="brand" aria-label="Say More Psychotherapy — home">
        <img src="/logo.jpg" alt="Say More Psychotherapy" />
      </a>
      <nav class="nav__links">
        <a href="/index.html">Home</a>
        <a href="/about.html">About</a>
        <div class="nav__item nav__item--has-dropdown">
          <a href="/services.html">Services <span class="nav__item__caret">⌄</span></a>
          <div class="nav__dropdown">
            <a href="/anxiety-therapy.html">Anxiety Therapy</a>
            <a href="/depression-counselling.html">Depression Counselling</a>
            <a href="/couples-therapy.html">Couples Therapy</a>
            <a href="/relationship-issues.html">Relationship Issues</a>
            <a href="/perinatal-postpartum.html">Infertility, Perinatal &amp; Postpartum</a>
            <a href="/mens-issues.html">Men's Issues</a>
            <a href="/parenting.html">Parenting</a>
            <a href="/adhd.html">ADHD in Adults and Adolescents</a>
            <a href="/immigrants-identity.html">Immigrants &amp; Identity</a>
          </div>
        </div>
        <a href="/location.html">Location</a>
        <a href="/blog.html" class="is-active">Blog</a>
      </nav>
      <div class="nav__cta">
        <a href="tel:+16479150231" class="nav__phone">
          <span class="emo emo--sm">📞</span>
          (647) 915-0231
        </a>
        <a href="/consultation.html" class="btn btn--primary">Get Free Session</a>
      </div>
      <button class="nav__toggle" id="navToggle" aria-label="Open menu" aria-expanded="false" aria-controls="navMobile">
        <span class="emo emo--lg">☰</span>
      </button>
    </div>
  </header>

  <div class="nav__mobile" id="navMobile" aria-hidden="true">
    <div class="nav__mobile__head">
      <a href="/index.html" class="brand"><img src="/logo.jpg" alt="Say More Psychotherapy" /></a>
      <button class="nav__mobile__close" id="navClose" aria-label="Close menu">
        <span class="emo emo--lg">✕</span>
      </button>
    </div>
    <nav class="nav__mobile__links">
      <a href="/index.html">Home</a>
      <a href="/about.html">About</a>
      <details class="nav__mobile__submenu">
        <summary>Services <span class="nav__mobile__submenu__caret">⌄</span></summary>
        <div class="nav__mobile__submenu__items">
          <a href="/services.html">All Services</a>
          <a href="/anxiety-therapy.html">Anxiety Therapy</a>
          <a href="/depression-counselling.html">Depression Counselling</a>
          <a href="/couples-therapy.html">Couples Therapy</a>
          <a href="/relationship-issues.html">Relationship Issues</a>
          <a href="/perinatal-postpartum.html">Infertility, Perinatal &amp; Postpartum</a>
          <a href="/mens-issues.html">Men's Issues</a>
          <a href="/parenting.html">Parenting</a>
          <a href="/adhd.html">ADHD in Adults and Adolescents</a>
          <a href="/immigrants-identity.html">Immigrants &amp; Identity</a>
        </div>
      </details>
      <a href="/location.html">Location</a>
      <a href="/blog.html">Blog</a>
    </nav>
    <div class="nav__mobile__cta">
      <a href="tel:+16479150231" class="nav__mobile__phone">
        <span class="emo emo--sm">📞</span>
        (647) 915-0231
      </a>
      <a href="/consultation.html" class="btn btn--primary">Get Free Session</a>
    </div>
  </div>

  <article class="blog-post">
    <div class="wrap wrap--narrow">
      <a href="/blog.html" class="back-link">
        <span class="back-link__icon"><span class="emo emo--sm">←</span></span>
        Back to Blog
      </a>

      <header class="blog-post__head">
        <span class="eyebrow">
          <span class="emo emo--md">📓</span>
          Notes from the practice
        </span>
        <h1 class="blog-post__title">${escapeHtml(title)}</h1>
        <div class="blog-post__meta">
          <span>${escapeHtml(author)}</span>
          ${dtHuman ? `<span aria-hidden="true">·</span><time datetime="${dtPublished}">${escapeHtml(dtHuman)}</time>` : ""}
        </div>
      </header>

      ${post.cover_image ? `<figure class="blog-post__cover"><img src="${escapeAttr(post.cover_image)}" alt="${escapeAttr(title)}" loading="lazy" /></figure>` : ""}

      <div class="blog-post__body prose">
        ${bodyHtml}
      </div>

      <hr class="blog-post__sep">

      <aside class="blog-post__cta">
        <h3>Considering therapy?</h3>
        <p>Paras offers a free 15-minute consultation — no pressure, just a conversation.</p>
        <a href="/consultation.html" class="btn btn--primary">Get Your Free 15 Min. Session <span class="arrow emo emo--sm">→</span></a>
      </aside>
    </div>
  </article>

  <footer class="foot">
    <div class="wrap">
      <div class="foot__top">
        <div>
          <a href="/index.html" class="foot__logo" aria-label="Say More Psychotherapy — home">
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
            <a href="/about.html">About</a>
            <a href="/services.html">Services</a>
            <a href="/location.html">Location</a>
            <a href="/blog.html">Blog</a>
            <a href="/consultation.html">Free Consultation</a>
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
        <div>© 2026 Say More Psychotherapy · Established With Care</div>
        <div class="foot__bottom__links">
          <a href="#">Privacy</a>
          <a href="/admin/login.html">Admin</a>
          <a href="#">CRPO Standards</a>
          <a href="#">Accessibility</a>
        </div>
      </div>
    </div>
  </footer>

  <a href="tel:+16479150231" class="call-widget" aria-label="Call Say More Psychotherapy">
    <svg class="call-widget__icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.37 1.9.72 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0122 16.92z"/></svg>
  </a>

  <script defer src="/_vercel/insights/script.js"></script>
  <script defer src="/_vercel/speed-insights/script.js"></script>
  <script src="/script.js"></script>
</body>
</html>`;
}

function notFoundHtml() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Not found — Say More Psychotherapy</title>
<link rel="stylesheet" href="/styles.css" /></head>
<body>
<div class="wrap" style="padding: 6rem 1rem; text-align:center;">
  <h1>404</h1><p>That post isn't here. <a href="/blog.html">Return to the blog</a>.</p>
</div></body></html>`;
}

export default async function handler(req, res) {
  try {
    const slug = req.query && req.query.slug;
    if (!slug) {
      res.status(400).setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end("<h1>Missing slug</h1>");
    }

    if (!sql) {
      res.status(503).setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end("<h1>Blog not configured yet.</h1>");
    }

    await ensureSchema();

    const rows = await sql`
      SELECT slug, title, meta_description, cover_image, og_image, body, body_format,
             excerpt, author, keywords, canonical_url, published_at, updated_at
      FROM posts
      WHERE slug = ${slug} AND published = TRUE
      LIMIT 1
    `;

    if (!rows.length) {
      res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(notFoundHtml());
    }

    const html = buildHtml(rows[0]);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).end(html);
  } catch (err) {
    console.error("blog-post error:", err);
    res.status(500).setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<h1>Something went wrong</h1><pre>${err && err.message ? err.message : String(err)}</pre>`);
  }
}
