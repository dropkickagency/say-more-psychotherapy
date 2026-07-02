import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "sm_admin";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function getSecret() {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "ADMIN_JWT_SECRET env var is not set (or is too short — needs 16+ chars)."
    );
  }
  return new TextEncoder().encode(s);
}

export async function signAdminToken() {
  return await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyAdminToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload && payload.role === "admin";
  } catch {
    return false;
  }
}

export function readCookie(req, name = COOKIE_NAME) {
  const raw = req.headers && req.headers.cookie;
  if (!raw) return null;
  const parts = raw.split(";");
  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function buildCookie(token) {
  const isProd =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${MAX_AGE}`,
    "SameSite=Lax",
    isProd ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearCookie() {
  const isProd =
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production";
  return [
    `${COOKIE_NAME}=`,
    "HttpOnly",
    "Path=/",
    "Max-Age=0",
    "SameSite=Lax",
    isProd ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export async function requireAdmin(req, res) {
  const token = readCookie(req);
  if (!token) {
    res.status(401).json({ error: "Not signed in." });
    return false;
  }
  const ok = await verifyAdminToken(token);
  if (!ok) {
    res.status(401).json({ error: "Session expired." });
    return false;
  }
  return true;
}
