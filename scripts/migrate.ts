import fs from "node:fs";
import path from "node:path";
import { pool } from "../src/lib/db";

export async function migrate({ reset = false, log = true } = {}) {
  const client = await pool.connect();
  try {
    if (reset) {
      await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
      if (log) console.log("schema reset");
    }
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const dir = path.join(__dirname, "..", "db", "migrations");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    const done = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
    for (const f of files) {
      if (done.has(f)) continue;
      const sql = fs.readFileSync(path.join(dir, f), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [f]);
        await client.query("COMMIT");
        if (log) console.log("applied", f);
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate({ reset: process.argv.includes("--reset") })
    .then(() => pool.end())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
