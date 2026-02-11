CREATE TABLE IF NOT EXISTS "timed_questions_classic_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timed_question_id" uuid NOT NULL,
	"question_ids" json NOT NULL,
	"subject_id" uuid
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timed_questions_classic_questions" ADD CONSTRAINT "timed_questions_classic_questions_timed_question_id_timed_questions_id_fk" FOREIGN KEY ("timed_question_id") REFERENCES "timed_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timed_questions_classic_questions" ADD CONSTRAINT "timed_questions_classic_questions_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
