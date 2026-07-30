import { put } from "@vercel/blob";
import { requireAdmin } from "../../lib/auth.js";

export const config = {
  api: {
    bodyParser: { sizeLimit: "10mb" },
  },
};

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

function safeExt(filename, mime) {
  const rawExt = String(filename || "").split(".").pop().toLowerCase();
  if (rawExt && rawExt.length <= 5 && /^[a-z0-9]+$/.test(rawExt)) return rawExt;
  return MIME_TO_EXT[mime] || "bin";
}

function makeKey(filename, mime) {
  const ext = safeExt(filename, mime);
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `blog/${ts}-${rand}.${ext}`;
}

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const { filename, mime, data } = body;

    if (!data || typeof data !== "string") {
      return res.status(400).json({ error: "Missing image data." });
    }
    if (!mime || !ALLOWED_MIME.has(String(mime).toLowerCase())) {
      return res.status(400).json({
        error: "Unsupported image type. Please upload a JPG, PNG, WebP, GIF, or SVG.",
      });
    }

    const buffer = Buffer.from(data, "base64");
    if (buffer.length === 0) {
      return res.status(400).json({ error: "Image data was empty." });
    }
    if (buffer.length > 8 * 1024 * 1024) {
      return res.status(413).json({ error: "Image is too large (max 8 MB)." });
    }

    // Preferred path: upload to Vercel Blob (fast, cached, cheap).
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const key = makeKey(filename, mime);
      const blob = await put(key, buffer, {
        access: "public",
        contentType: mime,
        addRandomSuffix: false,
      });
      return res.status(200).json({
        url: blob.url,
        size: buffer.length,
        contentType: mime,
        storage: "blob",
      });
    }

    // Fallback: no Blob configured → embed the image inline as a data URL.
    // Trade-off: bigger post size, slower first paint. But zero config,
    // works immediately, no external dependency.
    const dataUrl = `data:${mime};base64,${data}`;
    return res.status(200).json({
      url: dataUrl,
      size: buffer.length,
      contentType: mime,
      storage: "inline",
      warning:
        "Vercel Blob isn't configured, so this image is embedded inline in the post. This works, but posts with many images will be larger and slower to load. Enable Blob later for faster performance.",
    });
  } catch (err) {
    console.error("upload-image error:", err);
    const msg = err && err.message ? err.message : String(err);
    return res.status(500).json({ error: `Upload failed: ${msg}` });
  }
}
