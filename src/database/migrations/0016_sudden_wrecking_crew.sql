ALTER TABLE "tryout_batches" RENAME TO "tryout_sets";--> statement-breakpoint
ALTER TABLE "tryouts" RENAME COLUMN "end_time" TO "validity_date";--> statement-breakpoint
ALTER TABLE "tryout_sets" DROP CONSTRAINT "tryout_batches_id_order_number_unique";--> statement-breakpoint
ALTER TABLE "tryout_questions" DROP CONSTRAINT "tryout_questions_tryout_id_tryout_batches_id_fk";
--> statement-breakpoint
ALTER TABLE "tryout_questions" DROP CONSTRAINT "tryout_questions_question_id_questions_id_fk";
--> statement-breakpoint
ALTER TABLE "tryout_sets" DROP CONSTRAINT "tryout_batches_tryout_id_tryouts_id_fk";
--> statement-breakpoint
ALTER TABLE "tryout_sets" DROP CONSTRAINT "tryout_batches_subject_id_subjects_id_fk";
--> statement-breakpoint
ALTER TABLE "tryout_questions" ADD COLUMN "content" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tryout_questions" ADD COLUMN "content_image" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "tryout_questions" ADD COLUMN "options" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tryout_questions" ADD COLUMN "is_text_answer" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "tryout_user_attempts" ADD COLUMN "answer" text NOT NULL;--> statement-breakpoint
ALTER TABLE "tryout_user_attempts" ADD COLUMN "tryout_set" uuid;--> statement-breakpoint
ALTER TABLE "tryout_user_attempts" ADD COLUMN "tryout_question" uuid;--> statement-breakpoint
ALTER TABLE "tryouts" ADD COLUMN "correct_base_point" integer DEFAULT 4;--> statement-breakpoint
ALTER TABLE "tryouts" ADD COLUMN "wrong_base_point" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "tryouts" ADD COLUMN "is_irt" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tryouts" ADD COLUMN "label" text DEFAULT '';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_questions" ADD CONSTRAINT "tryout_questions_tryout_id_tryout_sets_id_fk" FOREIGN KEY ("tryout_id") REFERENCES "tryout_sets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_user_attempts" ADD CONSTRAINT "tryout_user_attempts_tryout_set_tryout_sets_id_fk" FOREIGN KEY ("tryout_set") REFERENCES "tryout_sets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_user_attempts" ADD CONSTRAINT "tryout_user_attempts_tryout_question_tryout_questions_id_fk" FOREIGN KEY ("tryout_question") REFERENCES "tryout_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_sets" ADD CONSTRAINT "tryout_sets_tryout_id_tryouts_id_fk" FOREIGN KEY ("tryout_id") REFERENCES "tryouts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_sets" ADD CONSTRAINT "tryout_sets_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "tryout_questions" DROP COLUMN IF EXISTS "question_id";--> statement-breakpoint
ALTER TABLE "tryout_user_attempts" DROP COLUMN IF EXISTS "user_answer";--> statement-breakpoint
ALTER TABLE "tryouts" DROP COLUMN IF EXISTS "base_point";--> statement-breakpoint
ALTER TABLE "tryout_sets" ADD CONSTRAINT "tryout_sets_id_order_number_unique" UNIQUE("id","order_number");