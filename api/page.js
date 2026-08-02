// Dynamic page renderer.
// Serves user-authored pages created via the admin website editor.
// Vercel's fallback rewrite in vercel.json sends any URL that has no
// static file to /api/page?slug=... — so /wellness-programs becomes
// /api/page?slug=wellness-programs.
//
// Returns 404 (as an HTML page) when the slug isn't in the pages table.

import { sql, ensureSchema } from "../lib/db.js";
import { renderPageHtml, render404Html } from "../lib/render-page.js";

export default async function handler(req, res) {
  const raw = String((req.query && req.query.slug) || "").trim();
  const slug = raw.replace(/^\/+|\/+$/g, "").toLowerCase();

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, must-revalidate");

  if (!slug || !sql) {
    return res.status(404).send(render404Html());
  }

  try {
    await ensureSchema();
    const rows = await sql`
      SELECT slug, title, sections, meta_description
      FROM pages
      WHERE slug = ${slug} AND published = TRUE
      LIMIT 1
    `;
    if (!rows.length) return res.status(404).send(render404Html());
    return res.status(200).send(renderPageHtml(rows[0]));
  } catch (err) {
    console.error("page render error:", err);
    return res.status(500).send(render404Html("Something went wrong loading this page."));
  }
}
