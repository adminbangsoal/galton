CREATE TABLE IF NOT EXISTS "referral_code" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"partner_name" varchar(100) NOT NULL,
	"discount" integer NOT NULL,
	"expired_at" timestamp NOT NULL,
	"is_active" boolean DEFAULT false,
	"max_usage" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referral_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_code" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transaction_orders" DROP CONSTRAINT "transaction_orders_referal_code_promos_code_fk";
--> statement-breakpoint
ALTER TABLE "transaction_orders" ADD COLUMN "referal" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction_orders" ADD CONSTRAINT "transaction_orders_referal_referral_code_id_fk" FOREIGN KEY ("referal") REFERENCES "referral_code"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "transaction_orders" DROP COLUMN IF EXISTS "referal_code";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "referral_usage" ADD CONSTRAINT "referral_usage_referral_code_referral_code_id_fk" FOREIGN KEY ("referral_code") REFERENCES "referral_code"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "referral_usage" ADD CONSTRAINT "referral_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "referral_usage" ADD CONSTRAINT "referral_usage_order_id_transaction_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "transaction_orders"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
