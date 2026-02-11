DO $$ BEGIN
 CREATE TYPE "timed_question_enum" AS ENUM('sequential', 'classic');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "timed_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"submitted_time" timestamp,
	"mode" "timed_question_enum" DEFAULT 'classic' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"subject_id" uuid NOT NULL,
	"max_number" integer NOT NULL,
	"current_number" integer DEFAULT 1,
	"question_ids" json NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "timed_questions_time_mapping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"time_limit" integer NOT NULL,
	CONSTRAINT "timed_questions_time_mapping_subject_id_unique" UNIQUE("subject_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timed_questions" ADD CONSTRAINT "timed_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timed_questions" ADD CONSTRAINT "timed_questions_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "timed_questions_time_mapping" ADD CONSTRAINT "timed_questions_time_mapping_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
