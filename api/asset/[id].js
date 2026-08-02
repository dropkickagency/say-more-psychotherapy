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
function copyToBytes(arrayLike) {
  const len = arrayLike.length;
  const ab = new ArrayBuffer(len);
  const view = new Uint8Array(ab);
  for (let i = 0; i < len; i++) view[i] = arrayLike[i] & 0xff;
  return view;
}
function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

// Neon's HTTP driver on this project transports BYTEA columns as JSON.
// What we receive is a "Buffer"/Uint8Array whose bytes are the UTF-8
// encoding of {"type":"Buffer","data":[…real image bytes…]}. To get the
// actual image, we have to decode as string → JSON.parse → pull `data`.
// Handles every other plausible shape as a fallback.
function toBytes(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw) &&
      !(raw instanceof Uint8Array) && Array.isArray(raw.data)) {
    // Already parsed object form
    return copyToBytes(raw.data);
  }
  let str;
  if (typeof raw === "string") {
    str = raw;
  } else if (raw && (raw instanceof Uint8Array || typeof raw.length === "number")) {
    str = new TextDecoder("utf-8").decode(raw instanceof Uint8Array ? raw : copyToBytes(raw));
  } else {
    str = String(raw);
  }
  // JSON-of-Buffer form (Neon HTTP quirk)
  try {
    const parsed = JSON.parse(str);
    if (parsed && Array.isArray(parsed.data)) return copyToBytes(parsed.data);
    if (Array.isArray(parsed)) return copyToBytes(parsed);
  } catch (e) { /* not JSON */ }
  // psql hex wire format: \x89504e...
  if (str.startsWith("\\x")) return hexToBytes(str.slice(2));
  // Last resort: char codes
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i) & 0xff;
  return bytes;
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
