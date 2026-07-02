import { sql, ensureSchema, assertDb } from "../../lib/db.js";
import { requireAdmin } from "../../lib/auth.js";

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (!assertDb(res)) return;

  try {
    await ensureSchema();

    const [
      totalLeadsRow,
      newLeadsRow,
      weekLeadsRow,
      totalPostsRow,
      publishedPostsRow,
      recentLeads,
      recentPosts,
    ] = await Promise.all([
      sql`SELECT COUNT(*)::int AS c FROM leads`,
      sql`SELECT COUNT(*)::int AS c FROM leads WHERE status = 'new'`,
      sql`SELECT COUNT(*)::int AS c FROM leads WHERE created_at > NOW() - INTERVAL '7 days'`,
      sql`SELECT COUNT(*)::int AS c FROM posts`,
      sql`SELECT COUNT(*)::int AS c FROM posts WHERE published = TRUE`,
      sql`SELECT id, name, email, phone, service, source_page, status, created_at FROM leads ORDER BY created_at DESC LIMIT 5`,
      sql`SELECT id, slug, title, published, published_at, updated_at FROM posts ORDER BY updated_at DESC LIMIT 5`,
    ]);

    res.status(200).json({
      stats: {
        totalLeads: totalLeadsRow[0]?.c || 0,
        newLeads: newLeadsRow[0]?.c || 0,
        weekLeads: weekLeadsRow[0]?.c || 0,
        totalPosts: totalPostsRow[0]?.c || 0,
        publishedPosts: publishedPostsRow[0]?.c || 0,
      },
      recentLeads,
      recentPosts,
    });
  } catch (err) {
    console.error("admin/overview error:", err);
    res.status(500).json({
      error: `Overview failed: ${err && err.message ? err.message : String(err)}`,
    });
  }
}
