-- Create subscriptions table
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_type" "subscriptions_type" NOT NULL,
	"transaction_id" text NOT NULL,
	"payment_date" timestamp DEFAULT now() NOT NULL,
	"expired_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Add foreign key constraints
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Create index for faster queries
CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_transaction_id_idx" ON "subscriptions" ("transaction_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_is_active_idx" ON "subscriptions" ("is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_expired_date_idx" ON "subscriptions" ("expired_date");
