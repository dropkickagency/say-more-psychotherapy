// Serves an asset stored in the Postgres `assets` table.
// URL: /api/asset/{id}
//
// Long, immutable cache: each asset has a permanent unique id, so once
// generated it never changes. Browsers + Vercel's edge cache can hold
// on to it indefinitely.

import { sql, ensureSchema } from "../../lib/db.js";

export default async function handler(req, res) {
  try {
    if (!sql) return res.status(503).end();
    const id = req.query && req.query.id;
    if (!id || !/^\d+$/.test(String(id))) return res.status(400).end();

    await ensureSchema();
    const rows = await sql`SELECT mime, data FROM assets WHERE id = ${id} LIMIT 1`;
    if (!rows.length) return res.status(404).end();

    const row = rows[0];
    const mime = row.mime || "application/octet-stream";
    // The neon driver returns BYTEA as a Buffer already in Node.js — good.
    const buf = row.data && row.data.length !== undefined ? row.data : Buffer.from(row.data);

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", buf.length);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.status(200).end(buf);
  } catch (err) {
    console.error("asset serve error:", err);
    return res.status(500).end();
  }
}
