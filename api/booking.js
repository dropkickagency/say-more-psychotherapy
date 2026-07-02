import { Resend } from "resend";
import { sql, ensureSchema } from "../lib/db.js";

// Lazy init so we don't crash the module at import time if env vars are missing.
let _resend = null;
function getResend() {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    const err = new Error("RESEND_API_KEY env var is not set on the server.");
    err.code = "NO_API_KEY";
    throw err;
  }
  _resend = new Resend(key);
  return _resend;
}

const TO_EMAIL = process.env.BOOKING_TO_EMAIL || "info@saymorepsychotherapy.ca";
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

function jsonError(res, status, message) {
  try {
    return res.status(status).json({ error: message });
  } catch (e) {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: message }));
  }
}

export default async function handler(req, res) {
  // Outer try/catch so ANY unexpected throw becomes a clean JSON error instead
  // of Vercel's generic "A server error has occurred" wrapper.
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return jsonError(res, 405, "Method not allowed.");

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const {
      name, email, phone, when, note, service, page, website,
      utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      fbclid, gclid, referrer, landing_page,
    } = body;

    // Honeypot
    if (website && String(website).trim() !== "") {
      return res.status(200).json({ ok: true });
    }

    if (!name || !phone || String(phone).trim() === "") {
      return jsonError(res, 400, "Name, email, and phone number are required.");
    }
    if (!isLikelyEmail(email)) {
      return jsonError(res, 400, "Please enter a valid email address.");
    }

    // Init Resend now (may throw if RESEND_API_KEY missing).
    let resend;
    try {
      resend = getResend();
    } catch (initErr) {
      console.error("Resend init failed:", initErr);
      return jsonError(res, 500, "Email service isn't configured. Please call us at (647) 915-0231.");
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
        <p style="margin: 0 0 8px;"><strong>Phone:</strong> <a href="tel:${safePhone.replace(/[^0-9+]/g, '')}" style="color:#9B7045;">${safePhone}</a></p>
        <p style="margin: 0 0 8px;"><strong>Email:</strong> <a href="mailto:${safeEmail}" style="color:#9B7045;">${safeEmail}</a></p>
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

    // 1) Send to the practice
    let practiceRes;
    try {
      practiceRes = await resend.emails.send({
        from: FROM_EMAIL,
        to: TO_EMAIL,
        replyTo: email,
        subject: practiceSubject,
        html: practiceHtml,
      });
    } catch (sendErr) {
      console.error("Resend send threw:", sendErr);
      const detail = sendErr && sendErr.message ? sendErr.message : String(sendErr);
      return jsonError(res, 502, `Email send failed: ${detail}`);
    }

    if (practiceRes && practiceRes.error) {
      console.error("Resend (practice) returned error:", practiceRes.error);
      const e = practiceRes.error;
      const detail = typeof e === "string" ? e : (e.message || JSON.stringify(e));
      return jsonError(res, 502, `Email rejected: ${detail}`);
    }

    // 2) Confirmation email to the client (best-effort)
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

    // 3) Persist the lead to the DB (best-effort — never blocks the booking flow)
    try {
      if (sql) {
        await ensureSchema();
        await sql`
          INSERT INTO leads (
            name, email, phone, service, "when", note, source_page, source, status,
            utm_source, utm_medium, utm_campaign, utm_content, utm_term,
            fbclid, gclid, referrer, landing_page
          )
          VALUES (
            ${name || ""},
            ${email || ""},
            ${phone || ""},
            ${service || ""},
            ${when || ""},
            ${note || ""},
            ${page || ""},
            'booking-form',
            'new',
            ${utm_source || null},
            ${utm_medium || null},
            ${utm_campaign || null},
            ${utm_content || null},
            ${utm_term || null},
            ${fbclid || null},
            ${gclid || null},
            ${referrer || null},
            ${landing_page || null}
          )
        `;
      }
    } catch (dbErr) {
      console.warn("Lead DB insert failed (non-fatal):", dbErr && dbErr.message ? dbErr.message : dbErr);
    }

    return res.status(200).json({ ok: true });
  } catch (outerErr) {
    console.error("Booking handler outer error:", outerErr);
    const detail = outerErr && outerErr.message ? outerErr.message : String(outerErr);
    return jsonError(res, 500, `Booking failed: ${detail}`);
  }
}
