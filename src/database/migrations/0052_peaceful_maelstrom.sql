ALTER TABLE "subjects" ADD COLUMN "slug" varchar(50);--> statement-breakpoint
ALTER TABLE "tryout_questions" ADD COLUMN "explanations" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "tryout_questions" ADD COLUMN "like_count" bigint;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_slug_unique" UNIQUE("slug");