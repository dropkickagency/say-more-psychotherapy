// Diagnostic endpoint — confirms what env vars the running function actually sees.
// Visit /api/health in your browser to use it.
// Never leaks the API key value, only its presence + length.

export default function handler(req, res) {
  const key = process.env.RESEND_API_KEY;
  const blob = process.env.BLOB_READ_WRITE_TOKEN;
  const pg = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  const adminPw = process.env.ADMIN_PASSWORD;
  const jwt = process.env.ADMIN_JWT_SECRET;

  const out = {
    // Vercel context
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelRegion: process.env.VERCEL_REGION || null,
    vercelUrl: process.env.VERCEL_URL || null,
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),

    // Resend (booking emails)
    hasResendKey: Boolean(key),
    resendKeyLength: key ? key.length : 0,
    resendKeyStartsWith: key ? key.slice(0, 3) : null,

    // Blob (image uploads)
    hasBlobToken: Boolean(blob),
    blobTokenLength: blob ? blob.length : 0,
    blobTokenStartsWith: blob ? blob.slice(0, 12) : null,   // vercel_blob_rw_

    // Postgres (leads + posts)
    hasPostgresUrl: Boolean(pg),
    postgresHost: pg ? (() => { try { return new URL(pg).host; } catch { return "(unparseable)"; } })() : null,

    // Admin auth
    hasAdminPassword: Boolean(adminPw),
    hasAdminJwtSecret: Boolean(jwt) && jwt.length >= 16,

    bookingToEmail: process.env.BOOKING_TO_EMAIL || "(default) info@saymorepsychotherapy.ca",
    bookingFromEmail: process.env.BOOKING_FROM_EMAIL || "(default) Say More Psychotherapy <bookings@bookings.saymorepsychotherapy.ca>",
  };
  res.status(200).json(out);
}
