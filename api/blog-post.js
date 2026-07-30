import { sql, ensureSchema } from "../lib/db.js";
import { readCookie, verifyAdminToken } from "../lib/auth.js";

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

function stripTags(html) {
  return String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function readingMinutes(html) {
  const words = stripTags(html).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

function buildHtml(post, opts = {}) {
  const isPreview = !!opts.isPreview;
  const isUnpublishedPreview = isPreview && !post.published;

  const title = post.title || "Blog";
  const desc =
    post.meta_description ||
    post.excerpt ||
    (post.body ? stripTags(post.body).slice(0, 155).trim() + "…" : "Notes from Say More Psychotherapy.");
  const url = `${SITE_URL}/blog/${post.slug}`;
  const canonical = post.canonical_url || url;
  const image = post.og_image || post.cover_image || `${SITE_URL}/main%20hero%20image.png`;
  const author = post.author || "Paras Geramian, RP (Qualifying)";
  const keywords = post.keywords || "";
  const bodyHtml = renderBody(post.body, post.body_format);
  const dtPublished = isoDate(post.published_at);
  const dtModified = isoDate(post.updated_at || post.published_at);
  const dtHuman = fmtDate(post.published_at);
  const readMin = readingMinutes(bodyHtml);
  const robots = post.published && !isPreview
    ? "index, follow, max-snippet:-1, max-image-preview:large"
    : "noindex, nofollow";

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
  <meta name="robots" content="${robots}" />

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

  ${isUnpublishedPreview ? `<div class="preview-banner">
    <span class="preview-banner__dot"></span>
    <strong>Preview mode</strong> — this post is a draft and is not yet visible to the public.
  </div>` : ""}

  <article class="blog-post">
    <div class="wrap wrap--narrow">
      <a href="/blog.html" class="back-link">
        <span class="back-link__icon"><span class="emo emo--sm">←</span></span>
        Back to Blog
      </a>

      <header class="blog-post__head">
        <h1 class="blog-post__title">${escapeHtml(title)}</h1>
        ${post.excerpt ? `<p class="blog-post__lead">${escapeHtml(post.excerpt)}</p>` : ""}

        <div class="blog-post__byline">
          <div class="blog-post__byline-author">
            <img class="blog-post__avatar" src="/paras%20blog%20avatar.jpg" alt="${escapeAttr(author.split(",")[0] || "Paras Geramian")}" loading="lazy" />
            <div class="blog-post__byline-text">
              <div class="blog-post__byline-name">Written by <a href="/about.html">${escapeHtml(author.split(",")[0] || "Paras Geramian")}</a></div>
              <div class="blog-post__byline-date">${dtHuman ? `Last Updated: <time datetime="${dtPublished}">${escapeHtml(dtHuman)}</time>` : ""} · ${readMin} min read</div>
            </div>
          </div>
          <div class="blog-post__share" role="group" aria-label="Share this post">
            <span class="blog-post__share-label">Share</span>
            <a class="share-btn share-btn--pinterest" target="_blank" rel="noopener" aria-label="Share on Pinterest"
               href="https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&amp;media=${encodeURIComponent(image)}&amp;description=${encodeURIComponent(title)}">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/></svg>
            </a>
            <a class="share-btn share-btn--facebook" target="_blank" rel="noopener" aria-label="Share on Facebook"
               href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a class="share-btn share-btn--twitter" target="_blank" rel="noopener" aria-label="Share on X (Twitter)"
               href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&amp;text=${encodeURIComponent(title)}">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a class="share-btn share-btn--reddit" target="_blank" rel="noopener" aria-label="Share on Reddit"
               href="https://reddit.com/submit?url=${encodeURIComponent(url)}&amp;title=${encodeURIComponent(title)}">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-6.988 4.87-3.86 0-6.989-2.176-6.989-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/></svg>
            </a>
            <a class="share-btn share-btn--linkedin" target="_blank" rel="noopener" aria-label="Share on LinkedIn"
               href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            </a>
            <a class="share-btn share-btn--email" aria-label="Share by email"
               href="mailto:?subject=${encodeURIComponent(title)}&amp;body=${encodeURIComponent(url)}">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
            </a>
          </div>
        </div>
      </header>

      ${post.cover_image ? `<figure class="blog-post__cover"><img src="${escapeAttr(post.cover_image)}" alt="${escapeAttr(title)}" loading="lazy" /></figure>` : ""}

      <div class="blog-post__body prose">
        ${bodyHtml}
      </div>

      <hr class="blog-post__sep">

      <aside class="blog-post__author">
        <div class="blog-post__author-avatar">
          <img src="/paras%20blog%20avatar.jpg" alt="${escapeAttr(author.split(",")[0] || "Paras Geramian")}" loading="lazy" />
        </div>
        <div class="blog-post__author-body">
          <div class="blog-post__author-eyebrow">Written by</div>
          <h3 class="blog-post__author-name">${escapeHtml(author.split(",")[0] || "Paras Geramian")}</h3>
          <p class="blog-post__author-credentials">${escapeHtml(author.includes(",") ? author.split(",").slice(1).join(",").trim() : "Registered Psychotherapist (Qualifying) · CRPO")}</p>
          <p class="blog-post__author-bio">Paras is a relational psychotherapist working in Brampton and across Ontario. Her practice draws from psychodynamic, mindfulness-based, and somatic traditions — slowing things down enough to notice the patterns shaping your life.</p>
          <div class="blog-post__author-links">
            <a href="/about.html">More about Paras →</a>
            <a href="/consultation.html">Book a free consultation →</a>
          </div>
        </div>
      </aside>

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

    // Preview mode: authenticated admin can render an unpublished draft.
    // Requested with ?preview=1. Anyone without a valid admin cookie sees the
    // normal "must be published" path.
    const wantsPreview = String((req.query && req.query.preview) || "") === "1";
    let previewAuthed = false;
    if (wantsPreview) {
      try {
        const token = readCookie(req);
        if (token) previewAuthed = await verifyAdminToken(token);
      } catch { /* fall through — treat as anonymous */ }
    }

    const rows = previewAuthed
      ? await sql`
          SELECT slug, title, meta_description, cover_image, og_image, body, body_format,
                 excerpt, author, keywords, canonical_url, published, published_at, updated_at
          FROM posts
          WHERE slug = ${slug}
          LIMIT 1
        `
      : await sql`
          SELECT slug, title, meta_description, cover_image, og_image, body, body_format,
                 excerpt, author, keywords, canonical_url, published, published_at, updated_at
          FROM posts
          WHERE slug = ${slug} AND published = TRUE
          LIMIT 1
        `;

    if (!rows.length) {
      res.status(404).setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(notFoundHtml());
    }

    const html = buildHtml(rows[0], { isPreview: previewAuthed });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    // Never cache preview responses — the draft can change moment-to-moment.
    if (previewAuthed) {
      res.setHeader("Cache-Control", "private, no-store");
    } else {
      res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    }
    res.status(200).end(html);
  } catch (err) {
    console.error("blog-post error:", err);
    res.status(500).setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<h1>Something went wrong</h1><pre>${err && err.message ? err.message : String(err)}</pre>`);
  }
}
