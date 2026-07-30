import { sql, ensureSchema, assertDb } from "../../lib/db.js";
import { requireAdmin } from "../../lib/auth.js";

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

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (!assertDb(res)) return;

  try {
    await ensureSchema();

    if (req.method === "GET") {
      const id = req.query && req.query.id;
      if (id) {
        const rows = await sql`SELECT * FROM posts WHERE id = ${id}`;
        if (!rows.length) return res.status(404).json({ error: "Not found" });
        return res.status(200).json({ post: rows[0] });
      }
      const rows = await sql`
        SELECT id, slug, title, meta_description, cover_image, published, published_at, updated_at, created_at
        FROM posts
        ORDER BY updated_at DESC
      `;
      return res.status(200).json({ posts: rows });
    }

    if (req.method === "POST") {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const p = body || {};

      if (!p.title || String(p.title).trim() === "") {
        return res.status(400).json({ error: "Title is required." });
      }

      let slug = p.slug && String(p.slug).trim() ? slugify(p.slug) : slugify(p.title);
      if (!slug || !SLUG_RE.test(slug)) {
        return res.status(400).json({ error: "Slug is invalid — use lowercase letters, numbers, and dashes." });
      }

      const existing = await sql`SELECT id FROM posts WHERE slug = ${slug}`;
      if (existing.length) {
        return res.status(409).json({ error: "A post with that slug already exists." });
      }

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
      const body =
        typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const p = body || {};
      if (!p.id) return res.status(400).json({ error: "id required" });

      const current = await sql`SELECT published, published_at FROM posts WHERE id = ${p.id}`;
      if (!current.length) return res.status(404).json({ error: "Not found" });
      const cur = current[0];

      // Slug validation if changed
      let nextSlug = p.slug ? slugify(p.slug) : null;
      if (p.slug !== undefined && (!nextSlug || !SLUG_RE.test(nextSlug))) {
        return res.status(400).json({ error: "Slug is invalid — use lowercase letters, numbers, and dashes." });
      }
      if (nextSlug) {
        const dup = await sql`SELECT id FROM posts WHERE slug = ${nextSlug} AND id <> ${p.id}`;
        if (dup.length) return res.status(409).json({ error: "That slug is used by another post." });
      }

      // Publish-date bookkeeping: stamp on first publish, keep on republish, null on unpublish
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
  } catch (err) {
    console.error("admin/posts error:", err);
    res.status(500).json({
      error: `Posts request failed: ${err && err.message ? err.message : String(err)}`,
    });
  }
}
