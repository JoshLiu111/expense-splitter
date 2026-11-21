ALTER TABLE "groups" ADD COLUMN "group_changes_started_on" date;--> statement-breakpoint
-- Activity recorded every kind of Group change from the deployment of
-- 2026-11-21 04:57:19 UTC on. Groups created before then have no entries for
-- their earlier Group changes. Dated in UTC, like "activity_started_on".
UPDATE "groups" SET "group_changes_started_on" = '2026-11-21' WHERE "created_at" < '2026-11-21T04:57:19Z';
