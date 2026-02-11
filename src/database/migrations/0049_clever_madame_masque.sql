ALTER TABLE "topics" DROP CONSTRAINT "topics_name_unique";--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_name_subject_id_unique" UNIQUE("name","subject_id");