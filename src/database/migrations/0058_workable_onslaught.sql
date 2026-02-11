CREATE TABLE IF NOT EXISTS "temp_question_subject" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" text NOT NULL,
	"question_id" uuid NOT NULL,
	"old_subject_id" uuid NOT NULL,
	"new_subject_id" uuid,
	"old_subject_name" text NOT NULL,
	"new_subject_name" text NOT NULL,
	"old_topic_id" uuid NOT NULL,
	"new_topic_id" uuid,
	"old_topic_name" text NOT NULL,
	"new_topic_name" text NOT NULL,
	"prediction_description" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "temp_question_subject" ADD CONSTRAINT "temp_question_subject_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "temp_question_subject" ADD CONSTRAINT "temp_question_subject_old_subject_id_subjects_id_fk" FOREIGN KEY ("old_subject_id") REFERENCES "subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "temp_question_subject" ADD CONSTRAINT "temp_question_subject_new_subject_id_subjects_id_fk" FOREIGN KEY ("new_subject_id") REFERENCES "subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "temp_question_subject" ADD CONSTRAINT "temp_question_subject_old_topic_id_topics_id_fk" FOREIGN KEY ("old_topic_id") REFERENCES "topics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "temp_question_subject" ADD CONSTRAINT "temp_question_subject_new_topic_id_topics_id_fk" FOREIGN KEY ("new_topic_id") REFERENCES "topics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
