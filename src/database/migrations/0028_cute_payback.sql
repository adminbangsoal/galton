ALTER TABLE "tryout_questions" RENAME COLUMN "tryout_id" TO "tryout_set_id";--> statement-breakpoint
ALTER TABLE "tryout_questions" DROP CONSTRAINT "tryout_questions_tryout_id_tryout_sets_id_fk";
--> statement-breakpoint
ALTER TABLE "tryout_questions" ALTER COLUMN "question_id" DROP NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_questions" ADD CONSTRAINT "tryout_questions_tryout_set_id_tryout_sets_id_fk" FOREIGN KEY ("tryout_set_id") REFERENCES "tryout_sets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_questions" ADD CONSTRAINT "tryout_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
