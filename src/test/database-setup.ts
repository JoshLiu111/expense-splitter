import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "../db/client";

/**
 * Vitest global setup: migrates the test database and empties it once per
 * run, before any test file starts. Test files share the database while
 * running in parallel, so none of them may truncate it themselves.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  const { db, pool } = createDatabase(url);
  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    await db.execute(sql`truncate table "user", groups cascade`);
  } finally {
    await pool.end();
  }
}
