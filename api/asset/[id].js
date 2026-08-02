// Serves an asset stored in the Postgres `assets` table.
// URL: /api/asset/{id}
//
// Runs on the Vercel Edge Runtime specifically because the Node runtime's
// res.end / res.write / res.send on this project keep JSON-stringifying
// Buffer bodies (Content-Type says image/webp but the body is
// `{"type":"Buffer","data":[…]}`). The Edge runtime uses the standard
// Web Fetch `Response` API, which returns a Uint8Array body verbatim
// with the headers we set — no wrapper interference.
//
// Long, immutable cache: each asset has a permanent unique id, so once
// generated it never changes. Browsers + Vercel's edge cache can hold
// on to it indefinitely.

import { neon } from "@neondatabase/serverless";

export const config = { runtime: "edge" };

const url =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING;
const sql = url ? neon(url) : null;

// Normalise whatever Neon's HTTP driver hands us for a BYTEA column
// into a Uint8Array. Handles real Buffers, Uint8Arrays, the JSON-shape
// {type:"Buffer", data:[…]}, plain int arrays, and psql hex strings.
function toBytes(raw) {
  if (raw instanceof Uint8Array) return raw;
  if (raw && Array.isArray(raw.data)) return new Uint8Array(raw.data);
  if (Array.isArray(raw)) return new Uint8Array(raw);
  if (typeof raw === "string") {
    const hex = raw.startsWith("\\x") ? raw.slice(2) : raw;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }
  // Fallback — best-effort byte view
  return new Uint8Array(raw);
}

export default async function handler(req) {
  try {
    if (!sql) return new Response("Database not configured", { status: 503 });
    const urlObj = new URL(req.url);
    // Vercel edge dynamic routes: the [id] segment is the last path segment.
    const parts = urlObj.pathname.split("/").filter(Boolean);
    const id = parts[parts.length - 1];
    if (!id || !/^\d+$/.test(id)) {
      return new Response("Bad id", { status: 400 });
    }

    const rows = await sql`SELECT mime, data FROM assets WHERE id = ${id} LIMIT 1`;
    if (!rows.length) return new Response("Not found", { status: 404 });

    // TEMP DEBUG: dump the shape Neon returns on Edge
    if (urlObj.searchParams.get("shape") === "1") {
      const raw = rows[0].data;
      const proto = Object.prototype.toString.call(raw);
      const info = {
        typeof: typeof raw,
        proto,
        isU8: raw instanceof Uint8Array,
        isArr: Array.isArray(raw),
        constructorName: raw && raw.constructor && raw.constructor.name,
        keys: raw && typeof raw === "object" ? Object.keys(raw).slice(0, 5) : null,
        hasData: raw && "data" in raw,
        dataIsArr: raw && Array.isArray(raw.data),
        firstBytes: raw && Array.isArray(raw.data) ? raw.data.slice(0, 6) : (typeof raw === "string" ? raw.slice(0, 16) : null),
      };
      return new Response(JSON.stringify(info, null, 2), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }

    const row = rows[0];
    const mime = row.mime || "application/octet-stream";
    const bytes = toBytes(row.data);

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return new Response("asset error: " + (err && err.message ? err.message : String(err)), { status: 500 });
  }
}
