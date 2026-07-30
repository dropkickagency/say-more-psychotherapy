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
