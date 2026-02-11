CREATE TABLE IF NOT EXISTS "tryout_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tryout_id" uuid NOT NULL,
	"created_at" timestamp,
	"first_task_submission" text DEFAULT '',
	"second_task_submission" text DEFAULT '',
	"third_task_submission" text DEFAULT '',
	CONSTRAINT "tryout_registrations_user_id_tryout_id_unique" UNIQUE("user_id","tryout_id")
);
