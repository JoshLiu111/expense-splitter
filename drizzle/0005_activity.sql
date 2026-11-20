CREATE TABLE "activity" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"seq" integer GENERATED ALWAYS AS IDENTITY (sequence name "activity_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"actor_member_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"change" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "activity_started_on" date;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_actor_member_id_members_id_fk" FOREIGN KEY ("actor_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_group_seq_idx" ON "activity" USING btree ("group_id","seq");--> statement-breakpoint
-- Groups that exist now predate Activity: their earlier Expenses and Settlements have no entries.
UPDATE "groups" SET "activity_started_on" = current_date;
