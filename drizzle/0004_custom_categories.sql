CREATE TABLE "custom_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_categories" ADD CONSTRAINT "custom_categories_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "custom_categories_group_id_idx" ON "custom_categories" USING btree ("group_id");