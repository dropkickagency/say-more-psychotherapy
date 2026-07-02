import { signAdminToken, buildCookie } from "../../lib/auth.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed." });
    }

    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const password = body && body.password;

    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return res
        .status(500)
        .json({ error: "ADMIN_PASSWORD env var not set on the server." });
    }

    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "Password required." });
    }

    if (password !== expected) {
      // Small delay to blunt trivial brute-forcing
      await new Promise((r) => setTimeout(r, 500));
      return res.status(401).json({ error: "Wrong password." });
    }

    const token = await signAdminToken();
    res.setHeader("Set-Cookie", buildCookie(token));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("admin/login error:", err);
    return res
      .status(500)
      .json({ error: `Login failed: ${err && err.message ? err.message : String(err)}` });
  }
}
