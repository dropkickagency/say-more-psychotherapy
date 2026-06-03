// Diagnostic endpoint — confirms what env vars the running function actually sees.
// Visit /api/health in your browser to use it.
// Never leaks the API key value, only its presence + length.

export default function handler(req, res) {
  const key = process.env.RESEND_API_KEY;
  const out = {
    hasResendKey: Boolean(key),
    resendKeyLength: key ? key.length : 0,
    resendKeyStartsWith: key ? key.slice(0, 3) : null,  // should be 're_'
    bookingToEmail: process.env.BOOKING_TO_EMAIL || "(default) info@saymorepsychotherapy.ca",
    bookingFromEmail: process.env.BOOKING_FROM_EMAIL || "(default) Say More Psychotherapy <bookings@bookings.saymorepsychotherapy.ca>",
    vercelEnv: process.env.VERCEL_ENV || null,
    vercelRegion: process.env.VERCEL_REGION || null,
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(out);
}
