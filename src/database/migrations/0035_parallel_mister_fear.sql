CREATE TABLE IF NOT EXISTS "tryout_pembahasan_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tryout_question_id" uuid,
	"user_id" uuid NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"is_liked" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tryout_question_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_url" text NOT NULL,
	"tryout_question_id" uuid,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "tryout_attempts" ADD COLUMN "score" integer;--> statement-breakpoint
ALTER TABLE "tryout_pembahasan" ADD COLUMN "like_count" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_pembahasan_feedback" ADD CONSTRAINT "tryout_pembahasan_feedback_tryout_question_id_tryout_questions_id_fk" FOREIGN KEY ("tryout_question_id") REFERENCES "tryout_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_pembahasan_feedback" ADD CONSTRAINT "tryout_pembahasan_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_question_notes" ADD CONSTRAINT "tryout_question_notes_tryout_question_id_tryout_questions_id_fk" FOREIGN KEY ("tryout_question_id") REFERENCES "tryout_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_question_notes" ADD CONSTRAINT "tryout_question_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
