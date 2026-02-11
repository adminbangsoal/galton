ALTER TABLE "temp_question_subject" DROP CONSTRAINT "temp_question_subject_old_subject_id_subjects_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "temp_question_subject" ADD CONSTRAINT "temp_question_subject_old_subject_id_subjects_id_fk" FOREIGN KEY ("old_subject_id") REFERENCES "subjects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
