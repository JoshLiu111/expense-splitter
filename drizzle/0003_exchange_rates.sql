CREATE TABLE "exchange_rates" (
	"base" text NOT NULL,
	"quote" text NOT NULL,
	"rate" text NOT NULL,
	"fetched_on" date NOT NULL,
	CONSTRAINT "exchange_rates_base_quote_pk" PRIMARY KEY("base","quote")
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "manual_rate" boolean DEFAULT false NOT NULL;