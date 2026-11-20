ALTER TABLE "expenses" ADD COLUMN "recorder_member_id" text;--> statement-breakpoint
ALTER TABLE "settlements" ADD COLUMN "recorder_member_id" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_recorder_member_id_members_id_fk" FOREIGN KEY ("recorder_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_recorder_member_id_members_id_fk" FOREIGN KEY ("recorder_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Existing records: the Recorder is the actor of the earliest entry that added them. Records with no such entry stay unknown.
UPDATE "expenses" SET "recorder_member_id" = (
	SELECT "actor_member_id" FROM "activity"
	WHERE "activity"."group_id" = "expenses"."group_id"
		AND "activity"."change"->>'kind' = 'expense-added'
		AND "activity"."change"->'expense'->>'id' = "expenses"."id"
	ORDER BY "activity"."seq" LIMIT 1
);--> statement-breakpoint
UPDATE "settlements" SET "recorder_member_id" = (
	SELECT "actor_member_id" FROM "activity"
	WHERE "activity"."group_id" = "settlements"."group_id"
		AND "activity"."change"->>'kind' = 'settlement-added'
		AND "activity"."change"->'settlement'->>'id' = "settlements"."id"
	ORDER BY "activity"."seq" LIMIT 1
);
