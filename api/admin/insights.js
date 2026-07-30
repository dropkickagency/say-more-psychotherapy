// Aggregates data from page_views for the admin Insights dashboard.
// GET /api/admin/insights?days=7 → totals + timeseries + breakdowns.

import { sql, ensureSchema, assertDb } from "../../lib/db.js";
import { requireAdmin } from "../../lib/auth.js";

function pctDelta(cur, prev) {
  cur = Number(cur) || 0;
  prev = Number(prev) || 0;
  if (prev === 0) return cur > 0 ? 100 : 0;
  return Math.round(((cur - prev) / prev) * 100);
}

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (!assertDb(res)) return;

  try {
    await ensureSchema();

    // Range: 1–90 days, default 7
    const days = Math.max(1, Math.min(90, parseInt(req.query && req.query.days) || 7));
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);

    const [
      totalCurRes,
      totalPrevRes,
      visitorsCurRes,
      visitorsPrevRes,
      bounceCurRes,
      bouncePrevRes,
      onlineRes,
      byDayRes,
      byPathRes,
      byReferrerRes,
      byCountryRes,
      byDeviceRes,
      byOSRes,
      byBrowserRes,
    ] = await Promise.all([
      sql`SELECT COUNT(*)::int AS c FROM page_views WHERE created_at >= ${since.toISOString()}`,
      sql`SELECT COUNT(*)::int AS c FROM page_views WHERE created_at >= ${prevSince.toISOString()} AND created_at < ${since.toISOString()}`,
      sql`SELECT COUNT(DISTINCT session_id)::int AS c FROM page_views WHERE created_at >= ${since.toISOString()}`,
      sql`SELECT COUNT(DISTINCT session_id)::int AS c FROM page_views WHERE created_at >= ${prevSince.toISOString()} AND created_at < ${since.toISOString()}`,
      sql`
        SELECT COALESCE(
          COUNT(*) FILTER (WHERE hits = 1)::float / NULLIF(COUNT(*), 0)::float * 100,
          0
        )::float AS bounce
        FROM (
          SELECT session_id, COUNT(*) AS hits FROM page_views
          WHERE created_at >= ${since.toISOString()}
          GROUP BY session_id
        ) s
      `,
      sql`
        SELECT COALESCE(
          COUNT(*) FILTER (WHERE hits = 1)::float / NULLIF(COUNT(*), 0)::float * 100,
          0
        )::float AS bounce
        FROM (
          SELECT session_id, COUNT(*) AS hits FROM page_views
          WHERE created_at >= ${prevSince.toISOString()} AND created_at < ${since.toISOString()}
          GROUP BY session_id
        ) s
      `,
      sql`SELECT COUNT(DISTINCT session_id)::int AS c FROM page_views WHERE created_at > NOW() - INTERVAL '5 minutes'`,
      sql`
        SELECT
          DATE_TRUNC('day', created_at AT TIME ZONE 'UTC') AS day,
          COUNT(DISTINCT session_id)::int AS visitors,
          COUNT(*)::int AS pageviews
        FROM page_views
        WHERE created_at >= ${since.toISOString()}
        GROUP BY day
        ORDER BY day
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
    res.status(200).json({
      range: { days, since: since.toISOString(), until: now.toISOString() },
      online: onlineRes[0]?.c || 0,
      totals: {
        pageviews: pv,
        pageviews_delta_pct: pctDelta(pv, pvPrev),
        visitors: vis,
        visitors_delta_pct: pctDelta(vis, visPrev),
        bounce_rate: Math.round(bounce),
        // For bounce rate the delta is expressed as absolute percentage-point change
        bounce_rate_delta_pp: Math.round(bounce) - Math.round(bouncePrev),
      },
      timeseries: byDayRes.map(r => ({
        day: r.day,
        visitors: r.visitors,
        pageviews: r.pageviews,
      })),
      pages: byPathRes,
      referrers: byReferrerRes,
      countries: byCountryRes,
      devices: byDeviceRes,
      os: byOSRes,
      browsers: byBrowserRes,
    });
  } catch (err) {
    console.error("admin/insights error:", err);
    res.status(500).json({
      error: `Insights failed: ${err && err.message ? err.message : String(err)}`,
    });
  }
}
