ALTER TABLE "tryout_attempts" ALTER COLUMN "score" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "tryout_attempts" ALTER COLUMN "score" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "tryout_set_attempts" ALTER COLUMN "score" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "tryout_set_attempts" ALTER COLUMN "score" SET DEFAULT 0;