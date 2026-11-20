import { sql } from "drizzle-orm";
import type { Database } from "@/db/client";

/**
 * Makes the test database refuse to link this one Member to a User, as a
 * failure part-way through claiming would; answers how to undo it. Only
 * that Member is affected, so other tests sharing the database aren't.
 */
export async function failClaiming(db: Database, memberId: string): Promise<() => Promise<void>> {
  const name = `fail_claim_${memberId.replace(/[^a-z0-9]/gi, "_")}`;
  await db.execute(
    sql.raw(`create function ${name}() returns trigger language plpgsql as $$
      begin raise exception 'claiming failed'; end $$`),
  );
  await db.execute(
    sql.raw(`create trigger ${name} before update on members for each row
      when (old.id = '${memberId}' and new.user_id is not null) execute function ${name}()`),
  );
  return async () => {
    await db.execute(sql.raw(`drop trigger ${name} on members`));
    await db.execute(sql.raw(`drop function ${name}()`));
  };
}
