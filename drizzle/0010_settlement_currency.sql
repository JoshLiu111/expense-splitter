ALTER TABLE "settlements" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "settlements" ADD COLUMN "locked_rate" text;--> statement-breakpoint
ALTER TABLE "settlements" ADD COLUMN "manual_rate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Existing Settlements were all in the Group Currency (ADR 0003), so their Settlement Currency is the Group's and their Locked Rate 1.
UPDATE "settlements" SET
	"currency" = (SELECT "currency" FROM "groups" WHERE "groups"."id" = "settlements"."group_id"),
	"locked_rate" = '1';--> statement-breakpoint
ALTER TABLE "settlements" ALTER COLUMN "currency" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "settlements" ALTER COLUMN "locked_rate" SET NOT NULL;
