DO $$ BEGIN
 CREATE TYPE "tryout_question_type" AS ENUM('multiple-choice', 'table-choice', 'fill-in');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "tryout_attempts" ADD COLUMN "filled_answers" jsonb;--> statement-breakpoint
ALTER TABLE "tryout_questions" ADD COLUMN "type" "tryout_question_type" DEFAULT 'multiple-choice' NOT NULL;--> statement-breakpoint
ALTER TABLE "tryout_questions" ADD COLUMN "answers" jsonb;--> statement-breakpoint
ALTER TABLE "tryouts" ADD COLUMN "is_window" boolean DEFAULT false;