import "server-only";
import { createDatabase, type Database } from "./client";

const globalForDb = globalThis as unknown as { expenseSplitterDb?: Database };

/** The app's database, created on first use so builds don't need DATABASE_URL. */
export function db(): Database {
  if (!globalForDb.expenseSplitterDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.expenseSplitterDb = createDatabase(url).db;
  }
  return globalForDb.expenseSplitterDb;
}
