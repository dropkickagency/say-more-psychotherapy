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
import { LAYOUTS, SECTION_LIBRARY } from "../../lib/render-page.js";

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

// ---- Media upload — images AND videos (Vercel Blob with base64 fallback) ----
const ALLOWED_MIME = new Set([
  // images
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
  // videos
  "video/mp4", "video/webm", "video/quicktime", "video/ogg",
]);
const MIME_TO_EXT = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "video/ogg": "ogv",
};
function safeExt(filename, mime) {
  const rawExt = String(filename || "").split(".").pop().toLowerCase();
  if (rawExt && rawExt.length <= 5 && /^[a-z0-9]+$/.test(rawExt)) return rawExt;
  return MIME_TO_EXT[mime] || "bin";
}
function makeKey(filename, mime) {
  const ext = safeExt(filename, mime);
  const folder = String(mime || "").startsWith("video/") ? "media" : "blog";
  return `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

async function handleUploadImage(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { filename, mime, data } = parseBody(req);
  if (!data || typeof data !== "string") return res.status(400).json({ error: "Missing file data." });
  const mimeLower = String(mime || "").toLowerCase();
  if (!mime || !ALLOWED_MIME.has(mimeLower)) {
    return res.status(400).json({ error: "Unsupported file type. Images: JPG/PNG/WebP/GIF/SVG. Videos: MP4/WebM/MOV/OGG." });
  }
  const isVideo = mimeLower.startsWith("video/");
  const buffer = Buffer.from(data, "base64");
  if (buffer.length === 0) return res.status(400).json({ error: "File data was empty." });
  const MAX_BYTES = isVideo ? 4 * 1024 * 1024 : 8 * 1024 * 1024;  // videos ≤ 4 MB (Vercel body limit); images ≤ 8 MB
  if (buffer.length > MAX_BYTES) {
    return res.status(413).json({
      error: isVideo
        ? "Video is too large (max 4 MB on this plan). Trim or compress it, or host it on YouTube/Vimeo and paste the embed URL later."
        : "Image is too large (max 8 MB).",
    });
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const key = makeKey(filename, mime);
    const blob = await put(key, buffer, {
      access: "public",
      contentType: mime,
      addRandomSuffix: false,
    });
    return res.status(200).json({ url: blob.url, size: buffer.length, contentType: mime, storage: "blob" });
  }

  // Videos are too big for base64 inline fallback — reject cleanly.
  if (isVideo) {
    return res.status(501).json({
      error: "Video uploads need Vercel Blob storage. In your Vercel dashboard → Storage → connect a Blob store to this project, then redeploy.",
    });
  }

  const dataUrl = `data:${mime};base64,${data}`;
  return res.status(200).json({
    url: dataUrl, size: buffer.length, contentType: mime, storage: "inline",
    warning: "Vercel Blob isn't configured, so this image is embedded inline. Enable Blob later for faster performance.",
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
    // "Online" = real (non-seed) sessions active in the last 5 minutes,
    // and always excluding any row dated in the future (defensive).
    sql`
      SELECT COUNT(DISTINCT session_id)::int AS c FROM page_views
      WHERE created_at > NOW() - INTERVAL '5 minutes'
        AND created_at <= NOW()
        AND session_id NOT LIKE 'seed_%'
    `,
    // Timeseries: clamp to now so no "future" bucket shows up if seed
    // rows drift ahead of clock skew.
    sql`
      SELECT DATE_TRUNC('day', created_at AT TIME ZONE 'UTC') AS day,
             COUNT(DISTINCT session_id)::int AS visitors,
             COUNT(*)::int AS pageviews
      FROM page_views
      WHERE created_at >= ${since.toISOString()}
        AND created_at <= NOW()
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

  // Self-heal: earlier versions of the seed didn't clamp timestamps, so some
  // seed rows ended up in the future and inflated the "online" count. Remove
  // them here so every insights visit corrects prior bad seeds automatically.
  const cleanup = await sql`
    DELETE FROM page_views
    WHERE session_id LIKE 'seed_%' AND created_at > NOW()
  `;

  const [countRow] = await sql`SELECT COUNT(*)::int AS c FROM page_views`;
  if (countRow.c > 200) {
    return res.status(200).json({
      ok: false,
      skipped: true,
      existing_rows: countRow.c,
      future_rows_cleaned: cleanup.count || 0,
      reason: "DB already has meaningful data — skipped to avoid double-seeding.",
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
  // Never generate a timestamp within the last 10 minutes or in the future —
  // that way seeded rows can't ever be counted as "online" active visitors.
  const MAX_MS = nowMs - 10 * 60 * 1000;
  let sessionCounter = 0;

  DAILY_SESSIONS.forEach((sessionCount, dayIdx) => {
    // dayIdx 0 = ~30 days ago, dayIdx 29 = today
    const daysAgo = DAILY_SESSIONS.length - 1 - dayIdx;
    const dayStartMs = nowMs - daysAgo * 86400000;

    for (let s = 0; s < sessionCount; s++) {
      sessionCounter++;
      const sessionId = `seed_${sessionCounter}_${Math.random().toString(36).slice(2, 8)}`;
      const startMs = Math.min(dayStartMs + irand(0, 86400000), MAX_MS);

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
        const hitMs = Math.min(startMs + h * irand(60000, 240000), MAX_MS);
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

// ---- Website editor content patches ----
// GET  /api/admin/edits?path=/foo    → list patches for a page
// GET  /api/admin/edits              → list all patches (grouped-friendly)
// POST /api/admin/edits              → upsert one or many
// DELETE /api/admin/edits?id=X       → remove a single patch
// DELETE /api/admin/edits?path=/foo  → remove every patch on a page
async function handleEdits(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (!assertDb(res)) return;
  await ensureSchema();

  if (req.method === "GET") {
    const path = req.query && req.query.path;
    const rows = path
      ? await sql`SELECT * FROM content_patches WHERE page_path = ${path} ORDER BY updated_at DESC`
      : await sql`SELECT page_path,
                          COUNT(*)::int AS n,
                          COUNT(*) FILTER (WHERE published = FALSE)::int AS draft_n,
                          MAX(updated_at) AS last_updated
                    FROM content_patches
                    GROUP BY page_path
                    ORDER BY last_updated DESC`;
    return res.status(200).json({ patches: rows });
  }

  if (req.method === "POST") {
    const body = parseBody(req);
    const patches = Array.isArray(body.patches) ? body.patches : (body.patches === undefined ? [body] : []);
    const pagePath = String(body.page_path || (patches[0] && patches[0].page_path) || "").trim();
    if (!pagePath) return res.status(400).json({ error: "page_path required" });

    const publish = body.publish === true;
    const publishAll = body.publish_all === true;

    let saved = 0;
    for (const p of patches) {
      if (!p.element_path || p.new_content == null) continue;
      await sql`
        INSERT INTO content_patches (page_path, element_path, element_type, new_content, original, published, updated_at)
        VALUES (
          ${pagePath},
          ${p.element_path},
          ${p.element_type || "text"},
          ${p.new_content},
          ${p.original || null},
          ${publish},
          NOW()
        )
        ON CONFLICT (page_path, element_path) DO UPDATE SET
          element_type = EXCLUDED.element_type,
          new_content  = EXCLUDED.new_content,
          -- Keep the first-ever original (raw HTML) across re-saves;
          -- chained edits would otherwise overwrite it with the previous
          -- edit output, breaking any future drift check.
          original     = COALESCE(content_patches.original, EXCLUDED.original),
          published    = CASE WHEN EXCLUDED.published THEN TRUE ELSE content_patches.published END,
          updated_at   = NOW()
      `;
      saved++;
    }

    // Publish everything currently in draft on this page (from earlier saves)
    let promoted = 0;
    if (publishAll) {
      const r = await sql`UPDATE content_patches SET published = TRUE, updated_at = NOW() WHERE page_path = ${pagePath} AND published = FALSE`;
      promoted = (r && r.count) || 0;
    }

    return res.status(200).json({ ok: true, saved, promoted, published: publish || publishAll });
  }

  if (req.method === "DELETE") {
    const id = req.query && req.query.id;
    const path = req.query && req.query.path;
    if (id) {
      await sql`DELETE FROM content_patches WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }
    if (path) {
      await sql`DELETE FROM content_patches WHERE page_path = ${path}`;
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: "id or path required" });
  }

  return res.status(405).json({ error: "Method not allowed." });
}

// ---- Pages (user-authored dynamic pages) ----
// Reserved slugs that would collide with static routes or api paths.
const RESERVED_SLUGS = new Set([
  "", "api", "admin", "assets", "_vercel", "blog",
  "about", "services", "location", "consultation", "index",
  "anxiety-therapy", "depression-counselling", "couples-therapy",
  "relationship-issues", "perinatal-postpartum", "mens-issues",
  "parenting", "adhd", "immigrants-identity", "thank-you",
  "sitemap", "robots", "logo",
]);

function normaliseSlug(input) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function handlePages(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (!assertDb(res)) return;
  await ensureSchema();

  const method = req.method || "GET";
  const q = req.query || {};
  const view = String(q.view || "").toLowerCase();

  // ---- Recently deleted tray ---------------------------------------
  if (method === "GET" && view === "trash") {
    const rows = await sql`
      SELECT id, slug, title, nav_label, deleted_at
      FROM pages
      WHERE deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
    `;
    return res.status(200).json({ pages: rows });
  }

  // ---- Restore a soft-deleted page --------------------------------
  if (method === "POST" && String(q.action || "") === "restore") {
    const slug = normaliseSlug(q.slug || parseBody(req).slug || "");
    if (!slug) return res.status(400).json({ error: "Slug required." });
    // Fail if a live page already claimed the slug while it was in the trash
    const [live] = await sql`SELECT id FROM pages WHERE slug = ${slug} AND deleted_at IS NULL LIMIT 1`;
    if (live) return res.status(409).json({ error: `A live page at "/${slug}" already exists — restore blocked to avoid overwriting it.` });
    const [row] = await sql`
      UPDATE pages SET deleted_at = NULL, updated_at = NOW()
      WHERE slug = ${slug} AND deleted_at IS NOT NULL
      RETURNING id, slug, title, nav_label, nav_order, published
    `;
    if (!row) return res.status(404).json({ error: "Page not in the trash." });
    return res.status(200).json({ ok: true, page: row });
  }

  // ---- Permanently purge a soft-deleted page ----------------------
  if (method === "DELETE" && String(q.hard || "") === "1") {
    const slug = normaliseSlug(q.slug || "");
    if (!slug) return res.status(400).json({ error: "Slug required." });
    const r = await sql`DELETE FROM pages WHERE slug = ${slug} AND deleted_at IS NOT NULL`;
    return res.status(200).json({ ok: true, purged: (r && r.count) || 0 });
  }

  if (method === "GET") {
    const slug = q.slug ? normaliseSlug(q.slug) : "";
    if (slug) {
      const [row] = await sql`SELECT * FROM pages WHERE slug = ${slug} AND deleted_at IS NULL LIMIT 1`;
      if (!row) return res.status(404).json({ error: "Page not found." });
      return res.status(200).json({ page: row });
    }
    const rows = await sql`
      SELECT id, slug, title, nav_label, nav_order, published, updated_at, created_at
      FROM pages WHERE deleted_at IS NULL ORDER BY nav_order ASC, id ASC
    `;
    return res.status(200).json({ pages: rows });
  }

  if (method === "POST") {
    const body = parseBody(req);
    const slug = normaliseSlug(body.slug || body.title);
    const title = String(body.title || "").trim();
    const layoutKey = String(body.layout || "blank").toLowerCase();
    const navLabel = body.nav_label === undefined ? title : (body.nav_label ? String(body.nav_label).trim() : null);
    const navOrder = Number.isFinite(body.nav_order) ? Math.round(body.nav_order) : 100;

    if (!title) return res.status(400).json({ error: "Title is required." });
    if (!slug) return res.status(400).json({ error: "Slug must contain at least one letter or number." });
    if (RESERVED_SLUGS.has(slug)) return res.status(409).json({ error: `"/${slug}" is reserved — pick a different slug.` });

    const layout = LAYOUTS[layoutKey] || LAYOUTS.blank;
    const sections = JSON.stringify(layout.sections || []);
    const metaDescription = typeof body.meta_description === "string" && body.meta_description.trim() ? body.meta_description.trim() : null;

    try {
      const [row] = await sql`
        INSERT INTO pages (slug, title, nav_label, nav_order, sections, meta_description)
        VALUES (${slug}, ${title}, ${navLabel || null}, ${navOrder}, ${sections}::jsonb, ${metaDescription})
        RETURNING id, slug, title, nav_label, nav_order, published, updated_at
      `;
      return res.status(200).json({ ok: true, page: row });
    } catch (err) {
      if (String(err.message || "").includes("duplicate")) {
        return res.status(409).json({ error: `A page at "/${slug}" already exists.` });
      }
      throw err;
    }
  }

  if (method === "PATCH") {
    const body = parseBody(req);
    const slug = normaliseSlug(body.slug || (req.query && req.query.slug));
    if (!slug) return res.status(400).json({ error: "Slug required." });

    const [current] = await sql`SELECT * FROM pages WHERE slug = ${slug} LIMIT 1`;
    if (!current) return res.status(404).json({ error: "Page not found." });

    const nextTitle       = typeof body.title === "string"           ? body.title.trim()                                : current.title;
    const nextNavLabel    = body.nav_label !== undefined              ? (body.nav_label ? String(body.nav_label).trim() : null) : current.nav_label;
    const nextNavOrder    = body.nav_order !== undefined              ? Math.round(Number(body.nav_order) || 100)        : current.nav_order;
    const nextMeta        = typeof body.meta_description === "string" ? body.meta_description                            : current.meta_description;
    const nextPublished   = typeof body.published === "boolean"       ? body.published                                   : current.published;
    const nextSections    = Array.isArray(body.sections)              ? JSON.stringify(body.sections)                    : JSON.stringify(current.sections);
    const nextMetaTitle   = typeof body.meta_title === "string"       ? (body.meta_title.trim()    || null)              : current.meta_title;
    const nextOgImage     = typeof body.og_image === "string"         ? (body.og_image.trim()      || null)              : current.og_image;
    const nextKeywords    = typeof body.keywords === "string"         ? (body.keywords.trim()      || null)              : current.keywords;
    const nextCanonical   = typeof body.canonical_url === "string"    ? (body.canonical_url.trim() || null)              : current.canonical_url;
    const nextNoindex     = typeof body.noindex === "boolean"         ? body.noindex                                     : current.noindex;

    const [row] = await sql`
      UPDATE pages
      SET title            = ${nextTitle},
          nav_label        = ${nextNavLabel},
          nav_order        = ${nextNavOrder},
          meta_description = ${nextMeta},
          published        = ${nextPublished},
          sections         = ${nextSections}::jsonb,
          meta_title       = ${nextMetaTitle},
          og_image         = ${nextOgImage},
          keywords         = ${nextKeywords},
          canonical_url    = ${nextCanonical},
          noindex          = ${nextNoindex},
          updated_at       = NOW()
      WHERE slug = ${slug}
      RETURNING id, slug, title, nav_label, nav_order, published, meta_title, meta_description, og_image, keywords, canonical_url, noindex, updated_at
    `;
    return res.status(200).json({ ok: true, page: row });
  }

  if (method === "DELETE") {
    const slug = normaliseSlug(q.slug || "");
    if (!slug) return res.status(400).json({ error: "Slug required." });
    // Soft delete — moves to the "Recently deleted" tray for 30 days.
    const r = await sql`
      UPDATE pages SET deleted_at = NOW(), updated_at = NOW()
      WHERE slug = ${slug} AND deleted_at IS NULL
    `;
    return res.status(200).json({ ok: true, deleted: (r && r.count) || 0 });
  }

  return res.status(405).json({ error: "Method not allowed." });
}

// ---- Sections API (Phase 2 & 3) --------------------------------------
// Read / mutate the sections array on a dynamic page. Used by the
// section-library picker (insert), the section-toolbar (up / down /
// duplicate / delete), and any bulk reorder in the future.
async function handleSections(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (!assertDb(res)) return;
  await ensureSchema();

  const q = req.query || {};
  const slug = normaliseSlug(q.slug || (parseBody(req).slug) || "");
  if (!slug) return res.status(400).json({ error: "Slug required." });

  const [page] = await sql`SELECT id, slug, sections FROM pages WHERE slug = ${slug} AND deleted_at IS NULL LIMIT 1`;
  if (!page) return res.status(404).json({ error: "Page not found." });
  const sections = Array.isArray(page.sections) ? page.sections.slice() : [];

  if (req.method === "GET") {
    return res.status(200).json({ slug, sections });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const body = parseBody(req);
  const action = String(body.action || "").toLowerCase();
  const idx = Number.isFinite(body.index) ? Math.max(0, Math.min(sections.length, body.index)) : sections.length;

  if (action === "insert") {
    // { action: "insert", index: N, section: {type, variant, content} }
    if (!body.section || !body.section.type) return res.status(400).json({ error: "section.type required" });
    sections.splice(idx, 0, body.section);
  } else if (action === "move") {
    // { action: "move", from: A, to: B }
    const from = Number(body.from);
    const to = Number(body.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || from >= sections.length) {
      return res.status(400).json({ error: "invalid move indexes" });
    }
    const boundedTo = Math.max(0, Math.min(sections.length - 1, to));
    const [item] = sections.splice(from, 1);
    sections.splice(boundedTo, 0, item);
  } else if (action === "duplicate") {
    const from = Number(body.index);
    if (!Number.isFinite(from) || from < 0 || from >= sections.length) return res.status(400).json({ error: "invalid index" });
    const copy = JSON.parse(JSON.stringify(sections[from]));
    sections.splice(from + 1, 0, copy);
  } else if (action === "delete") {
    const from = Number(body.index);
    if (!Number.isFinite(from) || from < 0 || from >= sections.length) return res.status(400).json({ error: "invalid index" });
    sections.splice(from, 1);
  } else if (action === "replace") {
    // Bulk replace (used for content edits saved via section renderer)
    if (!Array.isArray(body.sections)) return res.status(400).json({ error: "sections array required" });
    sections.length = 0;
    body.sections.forEach(s => sections.push(s));
  } else if (action === "update-content") {
    // Patch one section's `content` object with the fields in body.content.
    // Used for section-level property edits (star color, hero image, etc.)
    // that don't fit the click-to-edit-text model.
    const from = Number(body.index);
    if (!Number.isFinite(from) || from < 0 || from >= sections.length) return res.status(400).json({ error: "invalid index" });
    if (!body.content || typeof body.content !== "object") return res.status(400).json({ error: "content object required" });
    sections[from] = {
      ...sections[from],
      content: { ...(sections[from].content || {}), ...body.content },
    };
  } else {
    return res.status(400).json({ error: `Unknown action: ${action}` });
  }

  await sql`UPDATE pages SET sections = ${JSON.stringify(sections)}::jsonb, updated_at = NOW() WHERE id = ${page.id}`;
  return res.status(200).json({ ok: true, sections });
}

// ---- Nav-menu order + hide flags -------------------------------------
// The site's nav is a mix of hardcoded static routes and user-authored
// dynamic pages. The admin can reorder BOTH and hide individual items.
// Storage: single row in site_settings keyed 'nav' whose value is
//   { order: ["/", "/about", "/services", ...], hidden: ["/blog"] }
// Any item not present in `order` gets appended at the end.

// The canonical list of static routes the site knows about — kept in
// sync with the top-of-file nav in every static HTML file.
const STATIC_NAV = [
  { href: "/",             label: "Home" },
  { href: "/about",        label: "About" },
  { href: "/services",     label: "Services" },
  { href: "/location",     label: "Location" },
  { href: "/blog",         label: "Blog" },
];

function buildNavItems(customRows, cfg) {
  const custom = (customRows || []).map(p => ({
    href:  "/" + p.slug,
    label: p.nav_label || p.title,
    kind:  "custom",
    slug:  p.slug,
  }));
  const known = [...STATIC_NAV.map(x => ({ ...x, kind: "static" })), ...custom];
  const knownByHref = new Map(known.map(x => [x.href, x]));
  const order = Array.isArray(cfg.order) ? cfg.order : [];
  const hidden = new Set(Array.isArray(cfg.hidden) ? cfg.hidden : []);
  const seen = new Set();
  const ordered = [];
  order.forEach(h => {
    if (knownByHref.has(h) && !seen.has(h)) {
      ordered.push({ ...knownByHref.get(h), hidden: hidden.has(h) });
      seen.add(h);
    }
  });
  known.forEach(x => {
    if (!seen.has(x.href)) ordered.push({ ...x, hidden: hidden.has(x.href) });
  });
  return ordered;
}

async function readNavConfig() {
  const [row] = await sql`SELECT value FROM site_settings WHERE key = 'nav' LIMIT 1`;
  return (row && row.value) || { order: [], hidden: [] };
}

async function handleNav(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (!assertDb(res)) return;
  await ensureSchema();

  if (req.method === "GET") {
    const cfg = await readNavConfig();
    const customRows = await sql`
      SELECT slug, title, nav_label
      FROM pages
      WHERE deleted_at IS NULL AND nav_label IS NOT NULL AND nav_label <> ''
      ORDER BY nav_order ASC, id ASC
    `;
    return res.status(200).json({ items: buildNavItems(customRows, cfg) });
  }

  if (req.method === "POST") {
    const body = parseBody(req);
    const order  = Array.isArray(body.order)  ? body.order.filter(x => typeof x === "string") : [];
    const hidden = Array.isArray(body.hidden) ? body.hidden.filter(x => typeof x === "string") : [];
    const value = JSON.stringify({ order, hidden });
    await sql`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES ('nav', ${value}::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `;
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
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
  "edits":          handleEdits,
  "pages":          handlePages,
  "sections":       handleSections,
  "nav":            handleNav,
  "section-library": async function(req, res) {
    if (!(await requireAdmin(req, res))) return;
    // Also expose the layout starters so the modal picker can render both.
    const layouts = Object.entries(LAYOUTS).map(([key, l]) => ({ key, label: l.label, description: l.description, sections: l.sections }));
    return res.status(200).json({ library: SECTION_LIBRARY, layouts });
  },
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
