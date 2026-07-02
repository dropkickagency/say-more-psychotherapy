import { sql, ensureSchema } from "../lib/db.js";

export default async function handler(req, res) {
  try {
    if (!sql) return res.status(200).json({ posts: [] });
    await ensureSchema();

    const rows = await sql`
      SELECT slug, title, meta_description, cover_image, excerpt, published_at, author
      FROM posts
      WHERE published = TRUE
      ORDER BY published_at DESC
      LIMIT 200
    `;
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json({ posts: rows });
  } catch (err) {
    console.error("posts list error:", err);
    res.status(200).json({ posts: [], error: err && err.message ? err.message : String(err) });
  }
}
