// Fire-and-forget beacon receiver for page views.
// Called from every public page on load; never throws to the client,
// always responds 204 so the network waterfall stays clean.

import { sql, ensureSchema } from "../lib/db.js";

// A conservative bot filter — matches most crawlers and preview
// renderers so they don't pollute the metrics.
const BOT_RE =
  /bot|crawler|spider|slurp|Googlebot|Bingbot|DuckDuckBot|Mediapartners|preview|LinkedInBot|WhatsApp|Twitterbot|facebookexternalhit|Slackbot|TelegramBot|Discordbot|Applebot|SemrushBot|AhrefsBot|MJ12bot|PetalBot|YandexBot|Baiduspider|headless|monitor|pingdom|uptime|synthetic/i;

function parseUA(ua) {
  const s = String(ua || "");

  let device = "Desktop";
  if (/iPad|Tablet|SM-T|GT-P/i.test(s)) device = "Tablet";
  else if (/Mobile|Android|iPhone|iPod|Windows Phone|BlackBerry/i.test(s)) device = "Mobile";

  let os = "Unknown";
  if (/iPhone|iPad|iPod/.test(s)) os = "iOS";
  else if (/Android/.test(s)) os = "Android";
  else if (/Windows NT|Win64/.test(s)) os = "Windows";
  else if (/Mac OS X|Macintosh/.test(s)) os = "macOS";
  else if (/CrOS/.test(s)) os = "ChromeOS";
  else if (/Linux/.test(s)) os = "Linux";

  let browser = "Unknown";
  if (/Edg\//.test(s)) browser = "Edge";
  else if (/OPR\/|Opera/.test(s)) browser = "Opera";
  else if (/Chrome\//.test(s) && !/Chromium|Edg\//.test(s)) browser = "Chrome";
  else if (/Firefox\//.test(s)) browser = "Firefox";
  else if (/Safari\//.test(s) && !/Chrome\//.test(s)) browser = "Safari";

  return { device, os, browser };
}

function parseReferrerHost(ref) {
  if (!ref) return null;
  try {
    const h = new URL(ref).hostname.replace(/^www\./, "");
    return h || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      return res.status(200).end();
    }
    if (req.method !== "POST") return res.status(204).end();
    if (!sql) return res.status(204).end();

    const ua = String(req.headers["user-agent"] || "");
    if (BOT_RE.test(ua)) return res.status(204).end();

    // Body may arrive as a JSON string (from navigator.sendBeacon Blob) or
    // already-parsed object (from fetch with Content-Type).
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body || "{}"); } catch { body = {}; }
    }
    body = body || {};

    const path = String(body.path || "").slice(0, 500);
    const referrer = String(body.referrer || "").slice(0, 800);
    const session_id = String(body.session_id || "").slice(0, 100);
    const is_first_hit = !!body.first_hit;

    if (!path || !session_id) return res.status(204).end();
    // Never track admin pages — the practice shouldn't skew its own metrics
    if (/^\/admin(\/|$)/.test(path)) return res.status(204).end();

    const country = String(req.headers["x-vercel-ip-country"] || "").slice(0, 2).toUpperCase();
    const { device, os, browser } = parseUA(ua);
    const referrer_host = parseReferrerHost(referrer);

    await ensureSchema();
    await sql`
      INSERT INTO page_views (path, referrer, referrer_host, country, device_type, os_name, browser_name, session_id, is_first_hit)
      VALUES (
        ${path},
        ${referrer || null},
        ${referrer_host || null},
        ${country || null},
        ${device},
        ${os},
        ${browser},
        ${session_id},
        ${is_first_hit}
      )
    `;

    return res.status(204).end();
  } catch (err) {
    // Never let a broken beacon disrupt the user experience — swallow errors.
    console.warn("track error:", err && err.message ? err.message : err);
    return res.status(204).end();
  }
}
