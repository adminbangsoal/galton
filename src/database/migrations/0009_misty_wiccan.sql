ALTER TABLE "question_attempts" ADD COLUMN "timed_questions_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_timed_questions_id_timed_questions_id_fk" FOREIGN KEY ("timed_questions_id") REFERENCES "timed_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_timed_questions_id_unique" UNIQUE("timed_questions_id");