/* =========================
   Admin dashboard shared JS
   - Session gate: redirect to /admin/login if not authed
   - Utility fetch wrapper with error surfacing
   - Small helpers used by each admin view
   ========================= */

const AdminAPI = {
  async get(path) { return this._call(path, { method: "GET" }); },
  async post(path, body) { return this._call(path, { method: "POST", body }); },
  async patch(path, body) { return this._call(path, { method: "PATCH", body }); },
  async del(path) { return this._call(path, { method: "DELETE" }); },
  async _call(path, opts) {
    const init = {
      method: opts.method || "GET",
      credentials: "same-origin",
      headers: { "Accept": "application/json" },
    };
    if (opts.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    let res;
    try {
      res = await fetch(path, init);
    } catch (netErr) {
      throw new Error("Network error — check your connection.");
    }
    let json = null;
    try { json = await res.json(); } catch { /* no body */ }
    if (!res.ok) {
      if (res.status === 401 && !path.endsWith("/session") && !path.endsWith("/login")) {
        // Not logged in / expired — kick to login
        window.location.href = "/admin/login?next=" + encodeURIComponent(window.location.pathname);
        // Still throw so caller stops
        throw new Error("Not signed in.");
      }
      const msg = (json && (json.error || json.message)) || `Request failed (${res.status})`;
      throw new Error(msg);
    }
    return json || {};
  },
};

async function requireSession() {
  try {
    const res = await AdminAPI.get("/api/admin/session");
    if (!res.authenticated) {
      window.location.href = "/admin/login?next=" + encodeURIComponent(window.location.pathname);
      return false;
    }
    return true;
  } catch {
    window.location.href = "/admin/login";
    return false;
  }
}

async function logout() {
  try { await AdminAPI.post("/api/admin/logout", {}); } catch { /* ignore */ }
  window.location.href = "/admin/login";
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(d) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleString("en-CA", {
    year: "numeric", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function fmtRelative(d) {
  if (!d) return "";
  const dt = new Date(d).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - dt);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return fmtDate(d);
}

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function statusChip(status) {
  const s = String(status || "new").toLowerCase();
  return `<span class="chip chip--${escapeHtml(s)}">${escapeHtml(s)}</span>`;
}

function publishChip(published) {
  return published
    ? `<span class="chip chip--published">published</span>`
    : `<span class="chip chip--draft">draft</span>`;
}

// Classify a lead by its attribution fields. Returns { key, label }.
// `key` is the CSS chip modifier (chip--meta / chip--google-ads / etc).
function classifySource(lead) {
  if (!lead) return { key: 'direct', label: 'Direct' };
  const s = String(lead.utm_source || '').toLowerCase();
  const m = String(lead.utm_medium || '').toLowerCase();
  const ref = String(lead.referrer || '').toLowerCase();

  // Meta (fbclid is definitive, or utm_source=facebook/meta/instagram)
  if (lead.fbclid) return { key: 'meta', label: 'Meta Ads' };
  if (['facebook', 'meta', 'fb'].includes(s)) return { key: 'meta', label: 'Meta Ads' };
  if (['instagram', 'ig'].includes(s)) {
    return m === 'cpc' || m === 'paid' || m === 'ads'
      ? { key: 'meta', label: 'Instagram Ads' }
      : { key: 'meta', label: 'Instagram' };
  }
  // Google Ads (gclid is definitive; utm_source=google + cpc/paid medium is Ads too)
  if (lead.gclid) return { key: 'google-ads', label: 'Google Ads' };
  if (s === 'google' && (m === 'cpc' || m === 'paid' || m === 'ppc' || m === 'ads')) {
    return { key: 'google-ads', label: 'Google Ads' };
  }
  // Google organic
  if (s === 'google') return { key: 'google', label: 'Google Organic' };
  if (ref.includes('google.') && !ref.includes('googlesyndication')) return { key: 'google', label: 'Google Organic' };
  // LinkedIn
  if (s === 'linkedin' || ref.includes('linkedin.')) return { key: 'linkedin', label: 'LinkedIn' };
  // Bing
  if (s === 'bing' || ref.includes('bing.')) return { key: 'organic', label: 'Bing' };
  // Explicit UTM but unrecognized source
  if (lead.utm_source) return { key: 'other', label: lead.utm_source };
  // Non-search referral
  if (lead.referrer) {
    let host = '';
    try { host = new URL(lead.referrer).hostname.replace(/^www\./, ''); } catch { host = 'referral'; }
    if (host.includes('facebook') || host.includes('instagram')) return { key: 'meta', label: 'Meta' };
    return { key: 'referral', label: host };
  }
  return { key: 'direct', label: 'Direct' };
}

function sourceChip(lead) {
  const { key, label } = classifySource(lead);
  return `<span class="chip chip--${escapeHtml(key)}" title="${escapeHtml(label)}"><span class="chip__dot"></span>${escapeHtml(label)}</span>`;
}

function showAlert(container, message, type = "error") {
  if (!container) return;
  container.innerHTML = `<div class="alert alert--${type}">${escapeHtml(message)}</div>`;
  if (type === "success") {
    setTimeout(() => { container.innerHTML = ""; }, 3500);
  }
}

function bindSidebar() {
  const btn = document.getElementById("adminMenuToggle");
  const sb = document.getElementById("adminSidebar");
  if (btn && sb) {
    btn.addEventListener("click", () => sb.classList.toggle("is-open"));
    document.querySelectorAll(".admin__nav a").forEach(a => {
      a.addEventListener("click", () => sb.classList.remove("is-open"));
    });
  }
  const logoutBtn = document.getElementById("adminLogoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", (e) => { e.preventDefault(); logout(); });
}

function markActiveNav() {
  const path = window.location.pathname.replace(/\/$/, "");
  document.querySelectorAll(".admin__nav a").forEach(a => {
    const href = a.getAttribute("href");
    if (!href) return;
    const clean = href.replace(/\/$/, "");
    if (clean === path || (clean === "/admin/index" && (path === "/admin" || path === "/admin/index"))) {
      a.classList.add("is-active");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  bindSidebar();
  markActiveNav();
});

window.AdminAPI = AdminAPI;
window.requireSession = requireSession;
window.logout = logout;
window.fmtDate = fmtDate;
window.fmtDateTime = fmtDateTime;
window.fmtRelative = fmtRelative;
window.escapeHtml = escapeHtml;
window.statusChip = statusChip;
window.publishChip = publishChip;
window.classifySource = classifySource;
window.sourceChip = sourceChip;
window.showAlert = showAlert;
