CREATE TABLE "saved_bots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"xml" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "saved_bots_account_created_idx" ON "saved_bots" ("account_id","created_at");