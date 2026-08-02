import { neon } from "@neondatabase/serverless";

const url =
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!url) {
  console.warn(
    "[db] No POSTGRES_URL / DATABASE_URL env var set. DB calls will fail."
  );
}

export const sql = url ? neon(url) : null;

let _schemaEnsured = false;

export async function ensureSchema() {
  if (_schemaEnsured || !sql) return;
  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT,
      phone         TEXT,
      service       TEXT,
      "when"        TEXT,
      note          TEXT,
      source_page   TEXT,
      source        TEXT DEFAULT 'booking-form',
      status        TEXT DEFAULT 'new',
      admin_notes   TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Additive migrations for attribution — safe to run on cold start; each is a no-op after first time.
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source    TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium    TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign  TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_content   TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_term      TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS fbclid        TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS gclid         TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS referrer      TEXT`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS landing_page  TEXT`;
  await sql`CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_leads_utm_source ON leads(utm_source)`;

  await sql`
    CREATE TABLE IF NOT EXISTS posts (
      id                SERIAL PRIMARY KEY,
      slug              TEXT UNIQUE NOT NULL,
      title             TEXT NOT NULL,
      meta_description  TEXT,
      cover_image       TEXT,
      og_image          TEXT,
      body              TEXT,
      body_format       TEXT DEFAULT 'markdown',
      excerpt           TEXT,
      author            TEXT DEFAULT 'Paras Geramian, RP (Qualifying)',
      keywords          TEXT,
      canonical_url     TEXT,
      published         BOOLEAN DEFAULT FALSE,
      published_at      TIMESTAMPTZ,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Additive migrations for the blog editor upgrades
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS focus_keyword TEXT`;
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS categories    TEXT`;
  await sql`ALTER TABLE posts ADD COLUMN IF NOT EXISTS seo_score     INTEGER`;

  await sql`CREATE INDEX IF NOT EXISTS idx_posts_slug      ON posts(slug)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published, published_at DESC)`;

  // Analytics / Insights: one row per page view (fire-and-forget from beacon).
  await sql`
    CREATE TABLE IF NOT EXISTS page_views (
      id             SERIAL PRIMARY KEY,
      path           TEXT NOT NULL,
      referrer       TEXT,
      referrer_host  TEXT,
      country        TEXT,
      device_type    TEXT,
      os_name        TEXT,
      browser_name   TEXT,
      session_id     TEXT NOT NULL,
      is_first_hit   BOOLEAN DEFAULT FALSE,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_pv_created  ON page_views(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pv_session  ON page_views(session_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pv_path     ON page_views(path)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pv_ref_host ON page_views(referrer_host)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pv_country  ON page_views(country)`;

  // Website editor: content patches applied at page load time.
  // Each row overrides a specific element on a specific page.
  await sql`
    CREATE TABLE IF NOT EXISTS content_patches (
      id           SERIAL PRIMARY KEY,
      page_path    TEXT NOT NULL,
      element_path TEXT NOT NULL,
      element_type TEXT NOT NULL DEFAULT 'text',
      new_content  TEXT NOT NULL,
      original     TEXT,
      updated_at   TIMESTAMPTZ DEFAULT NOW(),
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uidx_patches_key ON content_patches(page_path, element_path)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_patches_page ON content_patches(page_path)`;
  await sql`ALTER TABLE content_patches ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE`;

  // Migrate legacy /page.html keys to clean URLs (/ for home, /page for others).
  // Vercel cleanUrls now serves and reports paths without .html, so the client
  // requests /api/edits?path=/about — patches saved as /about.html would be
  // invisible. Runs once per cold start; the WHERE clause skips clean rows.
  // Uses DO UPDATE conflict handling in case any row already exists at the
  // clean key (shouldn't happen, but safe).
  await sql`
    UPDATE content_patches
    SET page_path = CASE
      WHEN page_path = '/index.html' THEN '/'
      ELSE regexp_replace(page_path, '\\.html$', '')
    END
    WHERE page_path LIKE '%.html'
      AND NOT EXISTS (
        SELECT 1 FROM content_patches c2
        WHERE c2.page_path = CASE
          WHEN content_patches.page_path = '/index.html' THEN '/'
          ELSE regexp_replace(content_patches.page_path, '\\.html$', '')
        END
        AND c2.element_path = content_patches.element_path
      )
  `;
  // Drop any leftover .html-keyed rows that lost the race (their clean twin
  // already exists — the .html row is now the stale duplicate).
  await sql`DELETE FROM content_patches WHERE page_path LIKE '%.html'`;

  // One-off cleanup: strip editor-only helper classes ("sm-editable-text"
  // etc.) and contenteditable attributes that leaked into text patches
  // when the editor captured innerHTML mid-edit. If they stay in the
  // `original` column, the runtime drift-safety compare fails against
  // clean live HTML and every text patch is silently skipped. Idempotent
  // — the WHERE clause skips rows that are already clean.
  await sql`
    UPDATE content_patches
    SET new_content = regexp_replace(new_content, '\\s*sm-[a-z-]+', '', 'g'),
        original    = regexp_replace(COALESCE(original, ''), '\\s*sm-[a-z-]+', '', 'g')
    WHERE new_content ~ 'sm-editable-|sm-editing|sm-uploading'
       OR original    ~ 'sm-editable-|sm-editing|sm-uploading'
  `;
  await sql`
    UPDATE content_patches
    SET new_content = regexp_replace(new_content, '\\s+contenteditable="[^"]*"', '', 'g'),
        original    = regexp_replace(COALESCE(original, ''), '\\s+contenteditable="[^"]*"', '', 'g')
    WHERE new_content ~ 'contenteditable=' OR original ~ 'contenteditable='
  `;
  await sql`
    UPDATE content_patches
    SET new_content = regexp_replace(new_content, '\\s+class=""', '', 'g'),
        original    = regexp_replace(COALESCE(original, ''), '\\s+class=""', '', 'g')
    WHERE new_content LIKE '% class=""%' OR original LIKE '% class=""%'
  `;

  // Website editor: user-authored pages (Phase 1 of the "new page" feature).
  // Each row is one custom page served dynamically by /api/page.
  // `sections` is a JSONB array of {type, variant, content} entries — the
  // renderer walks it in order.
  await sql`
    CREATE TABLE IF NOT EXISTS pages (
      id                SERIAL PRIMARY KEY,
      slug              TEXT UNIQUE NOT NULL,
      title             TEXT NOT NULL,
      nav_label         TEXT,
      nav_order         INTEGER DEFAULT 100,
      sections          JSONB NOT NULL DEFAULT '[]'::jsonb,
      meta_description  TEXT,
      published         BOOLEAN DEFAULT TRUE,
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Soft delete — set instead of DROP so the "Recently deleted" tray can
  // restore for 30 days. A background sweep drops rows older than that.
  await sql`ALTER TABLE pages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pages_slug    ON pages(slug)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pages_nav     ON pages(nav_order, id) WHERE published = TRUE AND nav_label IS NOT NULL AND deleted_at IS NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_pages_deleted ON pages(deleted_at) WHERE deleted_at IS NOT NULL`;
  // Purge pages soft-deleted more than 30 days ago (idempotent, cheap).
  await sql`DELETE FROM pages WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days'`;

  _schemaEnsured = true;
}

export function assertDb(res) {
  if (!sql) {
    res.status(500).json({
      error:
        "Database is not configured. Add the Neon/Postgres integration in Vercel and set POSTGRES_URL.",
    });
    return false;
  }
  return true;
}

export default sql;
