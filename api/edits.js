// Public patch list for a given page path. Runtime patcher on every
// public page hits this and applies changes on top of the static HTML.
// Cached at the edge briefly so we're not hammering Postgres per view.

import { sql, ensureSchema } from "../lib/db.js";

export default async function handler(req, res) {
  try {
    if (!sql) return res.status(200).json({ patches: [] });
    const path = req.query && req.query.path;
    if (!path) return res.status(400).json({ error: "path required" });

    await ensureSchema();

    // Order by created_at ASC so insert-after / insert-before patches
    // apply in the same order they were authored — later patches were
    // captured against the DOM state that earlier inserts already
    // produced, so their nth-of-type anchors need earlier inserts to
    // have already shifted the DOM.
    const rows = await sql`
      SELECT element_path, element_type, new_content, original
      FROM content_patches
      WHERE page_path = ${path} AND published = TRUE
      ORDER BY created_at ASC, id ASC
    `;

    // Short edge cache to protect Postgres bandwidth. Vercel serves
    // cached responses to bursts of visitors instead of hitting the DB
    // for every page load. Stale-while-revalidate lets the CDN serve a
    // slightly stale copy while it refreshes in the background — new
    // Publish rolls out within ~30s. Combined with immutable /api/asset
    // caching, most public traffic now bypasses Postgres entirely.
    res.setHeader("Cache-Control", "public, max-age=30, s-maxage=30, stale-while-revalidate=60");
    return res.status(200).json({ patches: rows });
  } catch (err) {
    console.warn("edits list error:", err && err.message);
    // Never break a page — return empty on error.
    return res.status(200).json({ patches: [] });
  }
}
