ALTER TABLE "tryout_question_attempts" ADD COLUMN "filled_answers" jsonb;--> statement-breakpoint
ALTER TABLE "tryout_attempts" DROP COLUMN IF EXISTS "filled_answers";