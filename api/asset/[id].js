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
    // Neon's HTTP driver returns BYTEA in several possible shapes depending
    // on version + environment:
    //   - a real Node Buffer                        (best case)
    //   - a Uint8Array                              (some builds)
    //   - the JSON-serialised form {type:"Buffer", data:[...]}  <-- current issue
    //   - a hex string like "\x89504e470d0a…"       (default psql wire format)
    // All four must be normalised to a real Buffer before res.end(),
    // otherwise Node stringifies the object and the browser gets JSON
    // instead of image bytes.
    // Force a canonical fresh Node Buffer via base64 round-trip. Any
    // exotic shape Neon returns (Uint8Array, wrapped Buffer, etc.) gets
    // normalised. Prevents Vercel's response wrapper from JSON-stringifying.
    const raw = row.data;
    let b64;
    if (Buffer.isBuffer(raw) || raw instanceof Uint8Array) {
      b64 = Buffer.from(raw).toString("base64");
    } else if (raw && Array.isArray(raw.data)) {
      b64 = Buffer.from(raw.data).toString("base64");
    } else if (typeof raw === "string") {
      const hex = raw.startsWith("\\x") ? raw.slice(2) : raw;
      b64 = Buffer.from(hex, "hex").toString("base64");
    } else {
      b64 = Buffer.from(raw).toString("base64");
    }
    const buf = Buffer.from(b64, "base64");

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", buf.length);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.statusCode = 200;
    res.write(buf);
    res.end();
    return;
  } catch (err) {
    console.error("asset serve error:", err);
    return res.status(500).end();
  }
}
