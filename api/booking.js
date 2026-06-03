import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Where booking requests are delivered (the practice's inbox)
const TO_EMAIL = process.env.BOOKING_TO_EMAIL || "info@saymorepsychotherapy.ca";

// Verified sender on bookings.saymorepsychotherapy.ca
const FROM_EMAIL =
  process.env.BOOKING_FROM_EMAIL ||
  "Say More Psychotherapy <bookings@bookings.saymorepsychotherapy.ca>";

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isLikelyEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export default async function handler(req, res) {
  // CORS — only needed for cross-origin; same-origin works without these
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY env var is not set");
    return res.status(500).json({ error: "Server not configured." });
  }

  // Vercel parses JSON bodies automatically when Content-Type is application/json
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const { name, email, phone, when, note, service, page, website } = body;

  // Honeypot — bots happily fill every field including ones hidden via CSS.
  if (website && String(website).trim() !== "") {
    return res.status(200).json({ ok: true }); // silently accept, do nothing
  }

  if (!name || !isLikelyEmail(email)) {
    return res.status(400).json({ error: "Name and a valid email are required." });
  }

  const safeName = escapeHtml(name);
  const safeFirstName = safeName.split(" ")[0] || safeName;
  const safeEmail = escapeHtml(email);
  const safePhone = escapeHtml(phone);
  const safeWhen = escapeHtml(when);
  const safeNote = escapeHtml(note).replace(/\n/g, "<br>");
  const safeService = escapeHtml(service);
  const safePage = escapeHtml(page);

  const practiceSubject = `Booking request — ${safeName}${service ? ` (${safeService})` : ""}`;
  const clientSubject = "Thank you for requesting a booking";

  const practiceHtml = `
    <div style="font-family: -apple-system, system-ui, Segoe UI, Helvetica, Arial, sans-serif; color: #14110F; line-height: 1.55;">
      <h2 style="font-family: Georgia, serif; color: #745236; margin-bottom: 16px;">Booking request</h2>
      <p style="margin: 0 0 8px;"><strong>Name:</strong> ${safeName}</p>
      <p style="margin: 0 0 8px;"><strong>Email:</strong> <a href="mailto:${safeEmail}" style="color:#9B7045;">${safeEmail}</a></p>
      ${phone ? `<p style="margin: 0 0 8px;"><strong>Phone:</strong> ${safePhone}</p>` : ""}
      ${service ? `<p style="margin: 0 0 8px;"><strong>Service interest:</strong> ${safeService}</p>` : ""}
      ${when ? `<p style="margin: 0 0 8px;"><strong>When suits them:</strong> ${safeWhen}</p>` : ""}
      ${note ? `<p style="margin: 16px 0 8px;"><strong>Anything they'd like us to know:</strong></p><div style="padding: 12px 14px; background: #F7F4EE; border-radius: 8px; border-left: 3px solid #E8B8B0;">${safeNote}</div>` : ""}
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #E8E4DA;">
      <p style="color: #7A6A5C; font-size: 12px; margin: 0;">
        Submitted via saymorepsychotherapy.ca${page ? ` · <code>${safePage}</code>` : ""}<br>
        Reply directly to this email — it'll reach ${safeFirstName}.
      </p>
    </div>
  `;

  const clientHtml = `
    <div style="font-family: -apple-system, system-ui, Segoe UI, Helvetica, Arial, sans-serif; color: #14110F; line-height: 1.6; max-width: 560px;">
      <p>Hi ${safeFirstName},</p>
      <p>Thank you for requesting a booking. We will be in contact with you shortly.</p>
      <p>If you need to reach us in the meantime, you can reply to this email or call <a href="tel:+16479150231" style="color:#9B7045;">(647) 915-0231</a>.</p>
      <p style="margin-top: 24px;">Warmly,<br><strong>Paras Geramian</strong><br>Registered Psychotherapist (Qualifying) · CRPO</p>
      <hr style="margin: 24px 0; border: none; border-top: 1px solid #E8E4DA;">
      <p style="color: #7A6A5C; font-size: 12px; margin: 0;">
        Say More Psychotherapy<br>
        41 Edwin Drive, Brampton, ON L6Y 1A2<br>
        <a href="https://www.saymorepsychotherapy.ca" style="color:#9B7045;">www.saymorepsychotherapy.ca</a>
      </p>
    </div>
  `;

  try {
    // 1) Email the practice
    const practiceRes = await resend.emails.send({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      replyTo: email,
      subject: practiceSubject,
      html: practiceHtml,
    });

    if (practiceRes.error) {
      console.error("Resend (practice) error:", practiceRes.error);
      return res.status(502).json({ error: "Could not send your request. Please call us instead." });
    }

    // 2) Confirmation email to the client (best-effort; don't fail the request if this errors)
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: clientSubject,
        html: clientHtml,
      });
    } catch (confirmErr) {
      console.warn("Confirmation email failed (non-fatal):", confirmErr);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Booking handler error:", err);
    return res.status(500).json({
      error: "Something went wrong on our end. Please call us at (647) 915-0231.",
    });
  }
}
