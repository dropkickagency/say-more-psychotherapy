// Public list of user-authored pages that should appear in the nav.
// script.js fetches this on every public page load and appends any
// returned items to the primary + mobile nav menus.

import { sql, ensureSchema } from "../lib/db.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, must-revalidate");
  try {
    if (!sql) return res.status(200).json({ pages: [] });
    await ensureSchema();
    const rows = await sql`
      SELECT slug, title, nav_label, nav_order
      FROM pages
      WHERE published = TRUE AND nav_label IS NOT NULL AND nav_label <> ''
      ORDER BY nav_order ASC, id ASC
    `;
    return res.status(200).json({ pages: rows });
  } catch (err) {
    console.warn("public pages list error:", err && err.message);
    return res.status(200).json({ pages: [] });
  }
}
