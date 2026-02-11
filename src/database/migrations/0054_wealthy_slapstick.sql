DO $$ BEGIN
 CREATE TYPE "question_types" AS ENUM('multiple-choice', 'fill-in', 'table-choice');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "question_attempts" DROP CONSTRAINT "question_attempts_options_id_options_id_fk";
--> statement-breakpoint
ALTER TABLE "question_attempts" ALTER COLUMN "choice" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "question_attempts" ADD COLUMN "filled_answers" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "options" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "type" "question_types" DEFAULT 'multiple-choice' NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "filled_answer" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "question_attempts" DROP COLUMN IF EXISTS "options_id";