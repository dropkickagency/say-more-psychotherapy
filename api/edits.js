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

    const rows = await sql`
      SELECT element_path, element_type, new_content, original
      FROM content_patches
      WHERE page_path = ${path}
    `;

    // Cache briefly — trades a few seconds of staleness for way less DB load.
    // Admins see instant updates because their view uses the admin API directly.
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json({ patches: rows });
  } catch (err) {
    console.warn("edits list error:", err && err.message);
    // Never break a page — return empty on error.
    return res.status(200).json({ patches: [] });
  }
}
