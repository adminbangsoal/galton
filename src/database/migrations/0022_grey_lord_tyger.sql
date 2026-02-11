ALTER TABLE "tryout_user_attempts" RENAME TO "tryout_question_attempts";--> statement-breakpoint
ALTER TABLE "tryout_sets" DROP CONSTRAINT "tryout_sets_id_order_number_unique";--> statement-breakpoint
ALTER TABLE "tryout_question_attempts" DROP CONSTRAINT "tryout_user_attempts_tryout_question_user_id_tryout_set_unique";--> statement-breakpoint
ALTER TABLE "tryout_subjects" DROP CONSTRAINT "tryout_subjects_parent_id_tryout_subjects_id_fk";
--> statement-breakpoint
ALTER TABLE "tryout_question_attempts" DROP CONSTRAINT "tryout_user_attempts_tryout_id_tryouts_id_fk";
--> statement-breakpoint
ALTER TABLE "tryout_question_attempts" DROP CONSTRAINT "tryout_user_attempts_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "tryout_question_attempts" DROP CONSTRAINT "tryout_user_attempts_tryout_set_tryout_sets_id_fk";
--> statement-breakpoint
ALTER TABLE "tryout_question_attempts" DROP CONSTRAINT "tryout_user_attempts_tryout_question_tryout_questions_id_fk";
--> statement-breakpoint
ALTER TABLE "tryout_sets" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "tryout_question_attempts" ADD COLUMN "is_flagged" boolean DEFAULT false;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_question_attempts" ADD CONSTRAINT "tryout_question_attempts_tryout_id_tryouts_id_fk" FOREIGN KEY ("tryout_id") REFERENCES "tryouts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_question_attempts" ADD CONSTRAINT "tryout_question_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_question_attempts" ADD CONSTRAINT "tryout_question_attempts_tryout_set_tryout_sets_id_fk" FOREIGN KEY ("tryout_set") REFERENCES "tryout_sets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_question_attempts" ADD CONSTRAINT "tryout_question_attempts_tryout_question_tryout_questions_id_fk" FOREIGN KEY ("tryout_question") REFERENCES "tryout_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "tryout_sets" DROP COLUMN IF EXISTS "order_number";--> statement-breakpoint
ALTER TABLE "tryout_subjects" DROP COLUMN IF EXISTS "parent_id";--> statement-breakpoint
ALTER TABLE "tryout_sets" ADD CONSTRAINT "tryout_sets_tryout_id_subject_id_unique" UNIQUE("tryout_id","subject_id");--> statement-breakpoint
ALTER TABLE "tryout_question_attempts" ADD CONSTRAINT "tryout_question_attempts_tryout_question_user_id_tryout_set_unique" UNIQUE("tryout_question","user_id","tryout_set");