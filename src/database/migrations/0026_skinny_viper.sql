ALTER TABLE "tryout_attempts" RENAME COLUMN "timestamp" TO "started_at";--> statement-breakpoint
ALTER TABLE "tryout_set_attempts" RENAME COLUMN "timestamp" TO "started_at";--> statement-breakpoint
ALTER TABLE "tryout_attempts" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "tryout_set_attempts" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "tryouts" ADD COLUMN "is_kilat" boolean DEFAULT true;