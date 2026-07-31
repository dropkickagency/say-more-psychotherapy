// Consolidated admin endpoints — Vercel Hobby caps at 12 serverless
// functions per deployment, so all /api/admin/* routes are dispatched
// from this single dynamic route. Client URLs are unchanged
// (/api/admin/login, /api/admin/leads, etc.).

import { sql, ensureSchema, assertDb } from "../../lib/db.js";
import {
  signAdminToken, verifyAdminToken,
  readCookie, buildCookie, clearCookie,
  requireAdmin,
} from "../../lib/auth.js";
import { put } from "@vercel/blob";

// Needed by the upload-image handler; applies to all endpoints handled
// here — every other endpoint's body is small JSON so a larger limit
// is harmless.
export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
};

// =============================================================
// Shared helpers
// =============================================================
function parseBody(req) {
  return typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// =============================================================
// Handlers
// =============================================================

// ---- Auth: login / logout / session ----
async function handleLogin(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });
  const body = parseBody(req);
  const password = body && body.password;
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return res.status(500).json({ error: "ADMIN_PASSWORD env var not set on the server." });
  if (!password || typeof password !== "string") return res.status(400).json({ error: "Password required." });
  if (password !== expected) {
    await new Promise((r) => setTimeout(r, 500));
    return res.status(401).json({ error: "Wrong password." });
  }
  const token = await signAdminToken();
  res.setHeader("Set-Cookie", buildCookie(token));
  return res.status(200).json({ ok: true });
}

async function handleLogout(req, res) {
  res.setHeader("Set-Cookie", clearCookie());
  return res.status(200).json({ ok: true });
}

async function handleSession(req, res) {
  const token = readCookie(req);
  if (!token) return res.status(200).json({ authenticated: false });
  const ok = await verifyAdminToken(token);
  return res.status(200).json({ authenticated: !!ok });
}

// ---- Overview stats ----
async function handleOverview(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (!assertDb(res)) return;

  await ensureSchema();
  const [
    totalLeadsRow, newLeadsRow, weekLeadsRow,
    totalPostsRow, publishedPostsRow,
    recentLeads, recentPosts,
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int AS c FROM leads`,
    sql`SELECT COUNT(*)::int AS c FROM leads WHERE status = 'new'`,
    sql`SELECT COUNT(*)::int AS c FROM leads WHERE created_at > NOW() - INTERVAL '7 days'`,
    sql`SELECT COUNT(*)::int AS c FROM posts`,
    sql`SELECT COUNT(*)::int AS c FROM posts WHERE published = TRUE`,
    sql`SELECT id, name, email, phone, service, source_page, status, created_at FROM leads ORDER BY created_at DESC LIMIT 5`,
    sql`SELECT id, slug, title, published, published_at, updated_at FROM posts ORDER BY updated_at DESC LIMIT 5`,
  ]);

  return res.status(200).json({
    stats: {
      totalLeads: totalLeadsRow[0]?.c || 0,
      newLeads: newLeadsRow[0]?.c || 0,
      weekLeads: weekLeadsRow[0]?.c || 0,
      totalPosts: totalPostsRow[0]?.c || 0,
      publishedPosts: publishedPostsRow[0]?.c || 0,
    },
    recentLeads, recentPosts,
  });
}

// ---- Leads: GET list / PATCH one / DELETE one ----
async function handleLeads(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (!assertDb(res)) return;
  await ensureSchema();

  if (req.method === "GET") {
    const status = (req.query && req.query.status) || null;
    const rows = status
      ? await sql`SELECT * FROM leads WHERE status = ${status} ORDER BY created_at DESC LIMIT 500`
      : await sql`SELECT * FROM leads ORDER BY created_at DESC LIMIT 500`;
    return res.status(200).json({ leads: rows });
  }

  if (req.method === "PATCH") {
    const { id, status, admin_notes } = parseBody(req);
    if (!id) return res.status(400).json({ error: "id required" });
    await sql`
      UPDATE leads SET
        status      = COALESCE(${status ?? null}, status),
        admin_notes = COALESCE(${admin_notes ?? null}, admin_notes),
        updated_at  = NOW()
      WHERE id = ${id}
    `;
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const id = req.query && req.query.id;
    if (!id) return res.status(400).json({ error: "id required" });
    await sql`DELETE FROM leads WHERE id = ${id}`;
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed." });
}

// ---- Posts: GET (list or single) / POST / PATCH / DELETE ----
async function handlePosts(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (!assertDb(res)) return;
  await ensureSchema();

  if (req.method === "GET") {
    const id = req.query && req.query.id;
    if (id) {
      const rows = await sql`SELECT * FROM posts WHERE id = ${id}`;
      if (!rows.length) return res.status(404).json({ error: "Not found" });
      return res.status(200).json({ post: rows[0] });
    }
    const rows = await sql`
      SELECT id, slug, title, meta_description, excerpt, cover_image, published, published_at, updated_at, created_at
      FROM posts
      ORDER BY updated_at DESC
    `;
    return res.status(200).json({ posts: rows });
  }

  if (req.method === "POST") {
    const p = parseBody(req) || {};
    if (!p.title || String(p.title).trim() === "") {
      return res.status(400).json({ error: "Title is required." });
    }
    let slug = p.slug && String(p.slug).trim() ? slugify(p.slug) : slugify(p.title);
    if (!slug || !SLUG_RE.test(slug)) {
      return res.status(400).json({ error: "Slug is invalid — use lowercase letters, numbers, and dashes." });
    }
    const existing = await sql`SELECT id FROM posts WHERE slug = ${slug}`;
    if (existing.length) return res.status(409).json({ error: "A post with that slug already exists." });
    const willPublish = !!p.published;
    const publishedAt = willPublish ? new Date().toISOString() : null;
    const rows = await sql`
      INSERT INTO posts (
        slug, title, meta_description, cover_image, og_image,
        body, body_format, excerpt, author, keywords, canonical_url,
        focus_keyword, categories, seo_score,
        published, published_at
      ) VALUES (
        ${slug},
        ${String(p.title).trim()},
        ${p.meta_description || ""},
        ${p.cover_image || ""},
        ${p.og_image || ""},
        ${p.body || ""},
        ${p.body_format === "html" ? "html" : "markdown"},
        ${p.excerpt || ""},
        ${p.author || "Paras Geramian, RP (Qualifying)"},
        ${p.keywords || ""},
        ${p.canonical_url || ""},
        ${p.focus_keyword || ""},
        ${p.categories || ""},
        ${Number.isFinite(p.seo_score) ? p.seo_score : null},
        ${willPublish},
        ${publishedAt}
      )
      RETURNING id, slug
    `;
    return res.status(200).json({ id: rows[0].id, slug: rows[0].slug });
  }

  if (req.method === "PATCH") {
    const p = parseBody(req) || {};
    if (!p.id) return res.status(400).json({ error: "id required" });
    const current = await sql`SELECT published, published_at FROM posts WHERE id = ${p.id}`;
    if (!current.length) return res.status(404).json({ error: "Not found" });
    const cur = current[0];

    let nextSlug = p.slug ? slugify(p.slug) : null;
    if (p.slug !== undefined && (!nextSlug || !SLUG_RE.test(nextSlug))) {
      return res.status(400).json({ error: "Slug is invalid — use lowercase letters, numbers, and dashes." });
    }
    if (nextSlug) {
      const dup = await sql`SELECT id FROM posts WHERE slug = ${nextSlug} AND id <> ${p.id}`;
      if (dup.length) return res.status(409).json({ error: "That slug is used by another post." });
    }

    let publishedAt = cur.published_at;
    if (p.published === true && !cur.published) publishedAt = new Date().toISOString();
    if (p.published === false) publishedAt = null;

    await sql`
      UPDATE posts SET
        slug             = COALESCE(${nextSlug ?? null}, slug),
        title            = COALESCE(${p.title ?? null}, title),
        meta_description = COALESCE(${p.meta_description ?? null}, meta_description),
        cover_image      = COALESCE(${p.cover_image ?? null}, cover_image),
        og_image         = COALESCE(${p.og_image ?? null}, og_image),
        body             = COALESCE(${p.body ?? null}, body),
        body_format      = COALESCE(${p.body_format ?? null}, body_format),
        excerpt          = COALESCE(${p.excerpt ?? null}, excerpt),
        author           = COALESCE(${p.author ?? null}, author),
        keywords         = COALESCE(${p.keywords ?? null}, keywords),
        canonical_url    = COALESCE(${p.canonical_url ?? null}, canonical_url),
        focus_keyword    = COALESCE(${p.focus_keyword ?? null}, focus_keyword),
        categories       = COALESCE(${p.categories ?? null}, categories),
        seo_score        = COALESCE(${Number.isFinite(p.seo_score) ? p.seo_score : null}, seo_score),
        published        = COALESCE(${p.published ?? null}, published),
        published_at     = ${publishedAt},
        updated_at       = NOW()
      WHERE id = ${p.id}
    `;
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const id = req.query && req.query.id;
    if (!id) return res.status(400).json({ error: "id required" });
    await sql`DELETE FROM posts WHERE id = ${id}`;
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed." });
}

// ---- Image upload (Vercel Blob with base64 inline fallback) ----
const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
]);
const MIME_TO_EXT = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg",
};
function safeExt(filename, mime) {
  const rawExt = String(filename || "").split(".").pop().toLowerCase();
  if (rawExt && rawExt.length <= 5 && /^[a-z0-9]+$/.test(rawExt)) return rawExt;
  return MIME_TO_EXT[mime] || "bin";
}
function makeKey(filename, mime) {
  const ext = safeExt(filename, mime);
  return `blog/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

async function handleUploadImage(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { filename, mime, data } = parseBody(req);
  if (!data || typeof data !== "string") return res.status(400).json({ error: "Missing image data." });
  if (!mime || !ALLOWED_MIME.has(String(mime).toLowerCase())) {
    return res.status(400).json({ error: "Unsupported image type. Please upload a JPG, PNG, WebP, GIF, or SVG." });
  }
  const buffer = Buffer.from(data, "base64");
  if (buffer.length === 0) return res.status(400).json({ error: "Image data was empty." });
  if (buffer.length > 8 * 1024 * 1024) return res.status(413).json({ error: "Image is too large (max 8 MB)." });

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const key = makeKey(filename, mime);
    const blob = await put(key, buffer, {
      access: "public",
      contentType: mime,
      addRandomSuffix: false,
    });
    return res.status(200).json({ url: blob.url, size: buffer.length, contentType: mime, storage: "blob" });
  }

  const dataUrl = `data:${mime};base64,${data}`;
  return res.status(200).json({
    url: dataUrl, size: buffer.length, contentType: mime, storage: "inline",
    warning: "Vercel Blob isn't configured, so this image is embedded inline in the post. Enable Blob later for faster performance.",
  });
}

// ---- Insights (aggregations from page_views) ----
function pctDelta(cur, prev) {
  cur = Number(cur) || 0;
  prev = Number(prev) || 0;
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

async function handleInsights(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (!assertDb(res)) return;
  await ensureSchema();

  const days = Math.max(1, Math.min(90, parseInt(req.query && req.query.days) || 7));
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);

  const [
    totalCurRes, totalPrevRes,
    visitorsCurRes, visitorsPrevRes,
    bounceCurRes, bouncePrevRes,
    onlineRes,
    byDayRes,
    byPathRes, byReferrerRes, byCountryRes,
    byDeviceRes, byOSRes, byBrowserRes,
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int AS c FROM page_views WHERE created_at >= ${since.toISOString()}`,
    sql`SELECT COUNT(*)::int AS c FROM page_views WHERE created_at >= ${prevSince.toISOString()} AND created_at < ${since.toISOString()}`,
    sql`SELECT COUNT(DISTINCT session_id)::int AS c FROM page_views WHERE created_at >= ${since.toISOString()}`,
    sql`SELECT COUNT(DISTINCT session_id)::int AS c FROM page_views WHERE created_at >= ${prevSince.toISOString()} AND created_at < ${since.toISOString()}`,
    sql`
      SELECT COALESCE(COUNT(*) FILTER (WHERE hits = 1)::float / NULLIF(COUNT(*), 0)::float * 100, 0)::float AS bounce
      FROM (
        SELECT session_id, COUNT(*) AS hits FROM page_views
        WHERE created_at >= ${since.toISOString()}
        GROUP BY session_id
      ) s
    `,
    sql`
      SELECT COALESCE(COUNT(*) FILTER (WHERE hits = 1)::float / NULLIF(COUNT(*), 0)::float * 100, 0)::float AS bounce
      FROM (
        SELECT session_id, COUNT(*) AS hits FROM page_views
        WHERE created_at >= ${prevSince.toISOString()} AND created_at < ${since.toISOString()}
        GROUP BY session_id
      ) s
    `,
    sql`SELECT COUNT(DISTINCT session_id)::int AS c FROM page_views WHERE created_at > NOW() - INTERVAL '5 minutes'`,
    sql`
      SELECT DATE_TRUNC('day', created_at AT TIME ZONE 'UTC') AS day,
             COUNT(DISTINCT session_id)::int AS visitors,
             COUNT(*)::int AS pageviews
      FROM page_views WHERE created_at >= ${since.toISOString()}
      GROUP BY day ORDER BY day
    `,
    sql`
      SELECT path, COUNT(DISTINCT session_id)::int AS visitors FROM page_views
      WHERE created_at >= ${since.toISOString()}
      GROUP BY path ORDER BY visitors DESC LIMIT 10
    `,
    sql`
      SELECT referrer_host AS host, COUNT(DISTINCT session_id)::int AS visitors FROM page_views
      WHERE created_at >= ${since.toISOString()} AND referrer_host IS NOT NULL AND referrer_host != ''
      GROUP BY referrer_host ORDER BY visitors DESC LIMIT 10
    `,
    sql`
      SELECT country, COUNT(DISTINCT session_id)::int AS visitors FROM page_views
      WHERE created_at >= ${since.toISOString()} AND country IS NOT NULL AND country != ''
      GROUP BY country ORDER BY visitors DESC LIMIT 15
    `,
    sql`
      SELECT device_type AS type, COUNT(DISTINCT session_id)::int AS visitors FROM page_views
      WHERE created_at >= ${since.toISOString()}
      GROUP BY device_type ORDER BY visitors DESC
    `,
    sql`
      SELECT os_name AS name, COUNT(DISTINCT session_id)::int AS visitors FROM page_views
      WHERE created_at >= ${since.toISOString()}
      GROUP BY os_name ORDER BY visitors DESC LIMIT 10
    `,
    sql`
      SELECT browser_name AS name, COUNT(DISTINCT session_id)::int AS visitors FROM page_views
      WHERE created_at >= ${since.toISOString()}
      GROUP BY browser_name ORDER BY visitors DESC LIMIT 10
    `,
  ]);

  const pv = totalCurRes[0]?.c || 0;
  const pvPrev = totalPrevRes[0]?.c || 0;
  const vis = visitorsCurRes[0]?.c || 0;
  const visPrev = visitorsPrevRes[0]?.c || 0;
  const bounce = bounceCurRes[0]?.bounce || 0;
  const bouncePrev = bouncePrevRes[0]?.bounce || 0;

  res.setHeader("Cache-Control", "private, no-store");
  return res.status(200).json({
    range: { days, since: since.toISOString(), until: now.toISOString() },
    online: onlineRes[0]?.c || 0,
    totals: {
      pageviews: pv,
      pageviews_delta_pct: pctDelta(pv, pvPrev),
      visitors: vis,
      visitors_delta_pct: pctDelta(vis, visPrev),
      bounce_rate: Math.round(bounce),
      bounce_rate_delta_pp: Math.round(bounce) - Math.round(bouncePrev),
    },
    timeseries: byDayRes.map(r => ({ day: r.day, visitors: r.visitors, pageviews: r.pageviews })),
    pages: byPathRes,
    referrers: byReferrerRes,
    countries: byCountryRes,
    devices: byDeviceRes,
    os: byOSRes,
    browsers: byBrowserRes,
  });
}

// ---- Seed insights (one-time backfill matching Vercel's historical numbers) ----
// Generates realistic synthetic sessions across the last 30 days so the
// Insights dashboard has meaningful data immediately. Idempotent — refuses
// to re-seed if page_views already has more than 200 rows.
async function handleSeedInsights(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (!assertDb(res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  await ensureSchema();

  const [countRow] = await sql`SELECT COUNT(*)::int AS c FROM page_views`;
  if (countRow.c > 200) {
    return res.status(200).json({
      ok: false,
      skipped: true,
      existing_rows: countRow.c,
      reason: "DB already has meaningful data — skipped to avoid double-seeding. Truncate page_views first if you want to re-seed.",
    });
  }

  // ---- Distributions (from your Vercel dashboard) ----
  const PAGES = [
    ["/consultation.html", 274], ["/", 261], ["/services.html", 56],
    ["/about.html", 50], ["/index.html", 49], ["/thank-you.html", 32],
    ["/location.html", 19], ["/anxiety-therapy.html", 22],
    ["/depression-counselling.html", 18], ["/couples-therapy.html", 18],
    ["/relationship-issues.html", 18], ["/perinatal-postpartum.html", 15],
    ["/mens-issues.html", 15], ["/parenting.html", 15], ["/adhd.html", 15],
    ["/immigrants-identity.html", 15], ["/blog.html", 12],
  ];
  const COUNTRIES = [
    ["CA", 0.89], ["US", 0.08], ["IE", 0.01], ["FR", 0.005],
    ["MX", 0.003], ["PK", 0.003], ["GB", 0.005], ["DE", 0.002], ["IN", 0.002],
  ];
  const DEVICES = [["Mobile", 0.79], ["Desktop", 0.20], ["Tablet", 0.01]];
  const OSES = [["iOS", 0.61], ["Android", 0.20], ["Windows", 0.11], ["macOS", 0.06], ["Linux", 0.02]];
  const BROWSERS = [["Safari", 0.55], ["Chrome", 0.30], ["Edge", 0.08], ["Firefox", 0.05], ["Opera", 0.02]];
  // Referrer distribution: ~35% of sessions have a referrer, rest direct
  const REFERRERS = [
    ["google.com", 111], ["instagram.com", 109],
    ["m.facebook.com", 58], ["facebook.com", 22],
    ["l.instagram.com", 14], ["l.facebook.com", 12],
    ["psychologytoday.com", 5], ["google.ca", 3], ["linkedin.com", 2],
    [null, 700], // direct traffic — no referrer
  ];

  // Sessions per day — spike early, tapering to recent. Sums to ~500.
  const DAILY_SESSIONS = [
    45, 42, 38, 30, 28,   // 30–26 days ago (spike)
    25, 22, 20, 18, 16,   // 25–21 days ago
    18, 20, 22, 20, 15,   // 20–16 days ago
    12, 10,  8,  6,  5,   // 15–11 days ago
     5,  5,  4,  4,  3,   // 10–6 days ago
    10, 12,  6,  9, 14,   // 5–1 days ago (last week — recent uptick)
  ];

  function weighted(pairs) {
    const total = pairs.reduce((s, p) => s + p[1], 0);
    let r = Math.random() * total;
    for (const [key, w] of pairs) { r -= w; if (r <= 0) return key; }
    return pairs[pairs.length - 1][0];
  }
  function irand(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

  // ---- Generate rows ----
  const rows = [];
  const nowMs = Date.now();
  let sessionCounter = 0;

  DAILY_SESSIONS.forEach((sessionCount, dayIdx) => {
    // dayIdx 0 = ~30 days ago, dayIdx 29 = today
    const daysAgo = DAILY_SESSIONS.length - 1 - dayIdx;
    const dayStartMs = nowMs - daysAgo * 86400000;

    for (let s = 0; s < sessionCount; s++) {
      sessionCounter++;
      const sessionId = `seed_${sessionCounter}_${Math.random().toString(36).slice(2, 8)}`;
      const startMs = dayStartMs + irand(0, 86400000);

      // Bounce (single-hit) probability: recent traffic is less bouncy (~36%),
      // older traffic bouncier (~65%). Matches the 30d-vs-7d bounce gap.
      const bounceProb = daysAgo <= 7 ? 0.36 : 0.65;
      const bounce = Math.random() < bounceProb;
      const hitCount = bounce ? 1 : irand(2, 5);

      const country = weighted(COUNTRIES);
      const device = weighted(DEVICES);
      const os = weighted(OSES);
      const browser = weighted(BROWSERS);
      const referrerHost = weighted(REFERRERS);
      const referrer = referrerHost ? `https://${referrerHost}/` : null;

      for (let h = 0; h < hitCount; h++) {
        const path = weighted(PAGES);
        const hitMs = startMs + h * irand(60000, 240000); // 1–4 min between hits
        rows.push({
          path,
          referrer,
          referrer_host: referrerHost,
          country,
          device_type: device,
          os_name: os,
          browser_name: browser,
          session_id: sessionId,
          is_first_hit: h === 0,
          created_at: new Date(hitMs).toISOString(),
        });
      }
    }
  });

  // ---- Bulk-insert via UNNEST ----
  const CHUNK = 200;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await sql`
      INSERT INTO page_views (
        path, referrer, referrer_host, country,
        device_type, os_name, browser_name, session_id, is_first_hit, created_at
      )
      SELECT * FROM UNNEST(
        ${chunk.map(r => r.path)}::text[],
        ${chunk.map(r => r.referrer)}::text[],
        ${chunk.map(r => r.referrer_host)}::text[],
        ${chunk.map(r => r.country)}::text[],
        ${chunk.map(r => r.device_type)}::text[],
        ${chunk.map(r => r.os_name)}::text[],
        ${chunk.map(r => r.browser_name)}::text[],
        ${chunk.map(r => r.session_id)}::text[],
        ${chunk.map(r => r.is_first_hit)}::boolean[],
        ${chunk.map(r => r.created_at)}::timestamptz[]
      )
    `;
    inserted += chunk.length;
  }

  return res.status(200).json({
    ok: true,
    sessions_seeded: DAILY_SESSIONS.reduce((s, x) => s + x, 0),
    pageviews_seeded: inserted,
  });
}

// =============================================================
// Router
// =============================================================
const ROUTES = {
  "login":          handleLogin,
  "logout":         handleLogout,
  "session":        handleSession,
  "overview":       handleOverview,
  "leads":          handleLeads,
  "posts":          handlePosts,
  "upload-image":   handleUploadImage,
  "insights":       handleInsights,
  "seed-insights":  handleSeedInsights,
};

export default async function handler(req, res) {
  const endpoint = String((req.query && req.query.endpoint) || "").toLowerCase();
  const h = ROUTES[endpoint];
  if (!h) return res.status(404).json({ error: `Unknown admin endpoint: ${endpoint}` });
  try {
    return await h(req, res);
  } catch (err) {
    console.error(`admin/${endpoint} error:`, err);
    if (!res.headersSent) {
      return res.status(500).json({
        error: `${endpoint} failed: ${err && err.message ? err.message : String(err)}`,
      });
    }
  }
}
