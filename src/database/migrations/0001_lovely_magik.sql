CREATE TABLE IF NOT EXISTS "pdf" (
	"id" uuid,
	"filename" text,
	"url" text,
	"subject_id" uuid,
	"topic_id" uuid,
	"generated_url" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pdf" ADD CONSTRAINT "pdf_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pdf" ADD CONSTRAINT "pdf_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
