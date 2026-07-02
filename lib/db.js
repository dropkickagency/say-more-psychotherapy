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
  await sql`CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads(status)`;

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
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_slug      ON posts(slug)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published, published_at DESC)`;

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
