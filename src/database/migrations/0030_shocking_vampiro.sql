ALTER TABLE "tryout_set_attempts" ADD COLUMN "current_question_id" uuid NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_set_attempts" ADD CONSTRAINT "tryout_set_attempts_current_question_id_tryout_questions_id_fk" FOREIGN KEY ("current_question_id") REFERENCES "tryout_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
