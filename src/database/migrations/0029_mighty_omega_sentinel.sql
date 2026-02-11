ALTER TABLE "tryout_question_attempts" RENAME COLUMN "choice_id" TO "option_id";--> statement-breakpoint
ALTER TABLE "tryout_question_attempts" ALTER COLUMN "answer" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tryout_question_attempts" ALTER COLUMN "option_id" DROP NOT NULL;