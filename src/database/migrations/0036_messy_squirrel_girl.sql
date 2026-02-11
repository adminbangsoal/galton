ALTER TABLE "tryout_question_attempts" ADD COLUMN "score" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "tryout_questions" ADD COLUMN "correct_score_weight" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "tryout_questions" ADD COLUMN "wrong_score_weight" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "tryout_set_attempts" ADD COLUMN "score" integer;