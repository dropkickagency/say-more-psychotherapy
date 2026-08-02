// Public nav config for the site.
// Returns the ordered, visible nav items (static routes + user-authored
// pages) as configured in the admin's Nav Menu modal. script.js on
// every public page rebuilds the primary + mobile nav from this list.

import { sql, ensureSchema } from "../lib/db.js";

// MUST match STATIC_NAV in api/admin/[endpoint].js
const STATIC_NAV = [
  { href: "/",         label: "Home" },
  { href: "/about",    label: "About" },
  { href: "/services", label: "Services" },
  { href: "/location", label: "Location" },
  { href: "/blog",     label: "Blog" },
];

function buildOrdered(customRows, cfg) {
  const custom = (customRows || []).map(p => ({
    href:  "/" + p.slug,
    label: p.nav_label || p.title,
  }));
  const known = [...STATIC_NAV, ...custom];
  const knownByHref = new Map(known.map(x => [x.href, x]));
  const order  = Array.isArray(cfg.order)  ? cfg.order  : [];
  const hidden = new Set(Array.isArray(cfg.hidden) ? cfg.hidden : []);
  const seen = new Set();
  const ordered = [];
  order.forEach(h => {
    if (knownByHref.has(h) && !seen.has(h) && !hidden.has(h)) {
      ordered.push(knownByHref.get(h));
      seen.add(h);
    } else if (hidden.has(h)) {
      seen.add(h);   // don't append later either
    }
  });
  known.forEach(x => {
    if (!seen.has(x.href) && !hidden.has(x.href)) ordered.push(x);
  });
  return ordered;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, must-revalidate");
  try {
    if (!sql) return res.status(200).json({ items: STATIC_NAV, pages: [] });
    await ensureSchema();
    const [[cfgRow], customRows] = await Promise.all([
      sql`SELECT value FROM site_settings WHERE key = 'nav' LIMIT 1`,
      sql`
        SELECT slug, title, nav_label, nav_order
        FROM pages
        WHERE published = TRUE AND deleted_at IS NULL
          AND nav_label IS NOT NULL AND nav_label <> ''
        ORDER BY nav_order ASC, id ASC
      `,
    ]);
    const cfg = (cfgRow && cfgRow.value) || { order: [], hidden: [] };
    const items = buildOrdered(customRows, cfg);
    // `pages` kept for backwards compat with older cached script.js
    return res.status(200).json({ items, pages: customRows });
  } catch (err) {
    console.warn("public nav error:", err && err.message);
    return res.status(200).json({ items: STATIC_NAV, pages: [] });
  }
}
