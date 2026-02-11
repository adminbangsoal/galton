CREATE TABLE IF NOT EXISTS "tryout_pembahasan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tryout_question_id" uuid,
	"content" text NOT NULL,
	"content_image" text DEFAULT '',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "tryout_questions" ALTER COLUMN "options" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "tryout_user_attempts" ADD COLUMN "choice_id" text NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_pembahasan" ADD CONSTRAINT "tryout_pembahasan_tryout_question_id_tryout_questions_id_fk" FOREIGN KEY ("tryout_question_id") REFERENCES "tryout_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
