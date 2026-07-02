import { sql, ensureSchema, assertDb } from "../../lib/db.js";
import { requireAdmin } from "../../lib/auth.js";

export default async function handler(req, res) {
  if (!(await requireAdmin(req, res))) return;
  if (!assertDb(res)) return;

  try {
    await ensureSchema();

    if (req.method === "GET") {
      const status = (req.query && req.query.status) || null;
      const rows = status
        ? await sql`SELECT * FROM leads WHERE status = ${status} ORDER BY created_at DESC LIMIT 500`
        : await sql`SELECT * FROM leads ORDER BY created_at DESC LIMIT 500`;
      return res.status(200).json({ leads: rows });
    }

    if (req.method === "PATCH") {
      const body =
        typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      const { id, status, admin_notes } = body;
      if (!id) return res.status(400).json({ error: "id required" });

      await sql`
        UPDATE leads SET
          status      = COALESCE(${status ?? null}, status),
          admin_notes = COALESCE(${admin_notes ?? null}, admin_notes),
          updated_at  = NOW()
        WHERE id = ${id}
      `;
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const id = req.query && req.query.id;
      if (!id) return res.status(400).json({ error: "id required" });
      await sql`DELETE FROM leads WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (err) {
    console.error("admin/leads error:", err);
    res.status(500).json({
      error: `Leads request failed: ${err && err.message ? err.message : String(err)}`,
    });
  }
}
