ALTER TABLE "timed_questions" ADD COLUMN "current_question" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timed_questions" ADD CONSTRAINT "timed_questions_current_question_questions_id_fk" FOREIGN KEY ("current_question") REFERENCES "questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
