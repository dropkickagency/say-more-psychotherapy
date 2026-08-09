// Diagnostic endpoint — confirms what env vars the running function actually sees
// AND surfaces Neon storage / patch counts so we can see what's driving traffic.

import { sql } from "../lib/db.js";

export default async function handler(req, res) {
  const key = process.env.RESEND_API_KEY;
  const blob = process.env.BLOB_READ_WRITE_TOKEN;
  const pg = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const adminPw = process.env.ADMIN_PASSWORD;
  const jwt = process.env.ADMIN_JWT_SECRET;

  const out = {
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelRegion: process.env.VERCEL_REGION || null,
    vercelUrl: process.env.VERCEL_URL || null,
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),

    hasResendKey: Boolean(key),
    resendKeyLength: key ? key.length : 0,
    resendKeyStartsWith: key ? key.slice(0, 3) : null,

    hasBlobToken: Boolean(blob),
    blobTokenLength: blob ? blob.length : 0,
    blobTokenStartsWith: blob ? blob.slice(0, 12) : null,

    hasPostgresUrl: Boolean(pg),
    postgresHost: pg ? (() => { try { return new URL(pg).host; } catch { return "(unparseable)"; } })() : null,

    hasAdminPassword: Boolean(adminPw),
    hasAdminJwtSecret: Boolean(jwt) && jwt.length >= 16,

    bookingToEmail: process.env.BOOKING_TO_EMAIL || "(default) info@saymorepsychotherapy.ca",
    bookingFromEmail: process.env.BOOKING_FROM_EMAIL || "(default) Say More Psychotherapy <bookings@bookings.saymorepsychotherapy.ca>",
  };

  // Neon-side stats — what's actually stored and how big it is, so we
  // can eyeball what's driving the monthly transfer.
  if (sql) {
    try {
      const [
        [patches],
        [patchBytes],
        [assets],
        [assetBytes],
        [pages],
        [pageViewsTotal],
        [pageViews24h],
        [leads],
        [posts],
      ] = await Promise.all([
        sql`SELECT COUNT(*)::int AS n FROM content_patches`,
        sql`SELECT COALESCE(SUM(LENGTH(new_content))::bigint, 0) AS b FROM content_patches`,
        sql`SELECT COUNT(*)::int AS n FROM assets`,
        sql`SELECT COALESCE(SUM(size)::bigint, 0) AS b FROM assets`,
        sql`SELECT COUNT(*)::int AS n FROM pages WHERE deleted_at IS NULL`,
        sql`SELECT COUNT(*)::int AS n FROM page_views`,
        sql`SELECT COUNT(*)::int AS n FROM page_views WHERE created_at > NOW() - INTERVAL '24 hours'`,
        sql`SELECT COUNT(*)::int AS n FROM leads`,
        sql`SELECT COUNT(*)::int AS n FROM posts`,
      ]);
      out.storage = {
        content_patches: { rows: patches.n, bytes_new_content: Number(patchBytes.b) },
        assets:          { rows: assets.n, bytes_binary: Number(assetBytes.b) },
        pages:           { rows: pages.n },
        page_views:      { total: pageViewsTotal.n, last_24h: pageViews24h.n },
        leads:           { rows: leads.n },
        posts:           { rows: posts.n },
      };
    } catch (err) {
      out.storageError = err && err.message ? err.message : String(err);
    }
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(out);
}
