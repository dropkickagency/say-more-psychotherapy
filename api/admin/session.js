import { readCookie, verifyAdminToken } from "../../lib/auth.js";

export default async function handler(req, res) {
  try {
    const token = readCookie(req);
    if (!token) return res.status(200).json({ authenticated: false });
    const ok = await verifyAdminToken(token);
    return res.status(200).json({ authenticated: !!ok });
  } catch (err) {
    console.error("admin/session error:", err);
    return res.status(200).json({ authenticated: false });
  }
}
