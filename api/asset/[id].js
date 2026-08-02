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
    // TEMP DEBUG — echo shape info as JSON when ?debug=1
    if (req.query && req.query.debug === "1") {
      const raw = row.data;
      const info = {
        mime: row.mime,
        typeof: typeof raw,
        isBuffer: Buffer.isBuffer(raw),
        isUint8: raw instanceof Uint8Array,
        isArray: Array.isArray(raw),
        constructorName: raw && raw.constructor && raw.constructor.name,
        keys: raw && typeof raw === "object" ? Object.keys(raw).slice(0, 5) : null,
        hasDataProp: raw && "data" in raw,
        dataIsArray: raw && Array.isArray(raw.data),
        dataLen: raw && raw.data ? raw.data.length : null,
        firstBytes: raw && Array.isArray(raw.data) ? raw.data.slice(0, 8) : (typeof raw === "string" ? raw.slice(0, 16) : null),
      };
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(info);
    }

    const raw = row.data;
    let buf;
    let shape;
    if (Buffer.isBuffer(raw)) {
      buf = raw; shape = "buffer";
    } else if (raw instanceof Uint8Array) {
      buf = Buffer.from(raw); shape = "uint8";
    } else if (raw && Array.isArray(raw.data)) {
      // Handles the JSON-serialised Buffer form regardless of whether
      // raw.type === "Buffer" is present.
      buf = Buffer.from(raw.data); shape = "obj.data[]";
    } else if (raw && raw.data instanceof Uint8Array) {
      buf = Buffer.from(raw.data); shape = "obj.data.u8";
    } else if (Array.isArray(raw)) {
      buf = Buffer.from(raw); shape = "array";
    } else if (typeof raw === "string") {
      const hex = raw.startsWith("\\x") ? raw.slice(2) : raw;
      buf = Buffer.from(hex, "hex"); shape = "hexstr";
    } else if (raw && typeof raw === "object" && raw.constructor && raw.constructor.name) {
      buf = Buffer.from(raw); shape = "obj:" + raw.constructor.name;
    } else {
      buf = Buffer.from(String(raw)); shape = "fallback";
    }
    res.setHeader("X-Sm-Shape", shape);

    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", buf.length);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.status(200).end(buf);
  } catch (err) {
    console.error("asset serve error:", err);
    return res.status(500).end();
  }
}
