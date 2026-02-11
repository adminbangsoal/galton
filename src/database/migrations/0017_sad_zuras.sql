CREATE TABLE IF NOT EXISTS "tryout_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now(),
	"user_id" uuid,
	"tryout_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tryout_set_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now(),
	"tryout_id" uuid NOT NULL,
	"tryout_set_id" uuid NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tryout_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(30) NOT NULL,
	"time_limit" bigint,
	"questions_limit" integer,
	"parent_id" uuid
);
--> statement-breakpoint
ALTER TABLE "tryout_sets" DROP CONSTRAINT "tryout_sets_subject_id_subjects_id_fk";
--> statement-breakpoint
ALTER TABLE "tryout_sets" ALTER COLUMN "subject_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tryout_questions" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "tryouts" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "tryouts" ADD COLUMN "time_limit" bigint;--> statement-breakpoint
ALTER TABLE "tryouts" ADD COLUMN "buffer_duration" bigint DEFAULT 0;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_sets" ADD CONSTRAINT "tryout_sets_subject_id_tryout_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "tryout_subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_attempts" ADD CONSTRAINT "tryout_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_attempts" ADD CONSTRAINT "tryout_attempts_tryout_id_tryouts_id_fk" FOREIGN KEY ("tryout_id") REFERENCES "tryouts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_set_attempts" ADD CONSTRAINT "tryout_set_attempts_tryout_id_tryouts_id_fk" FOREIGN KEY ("tryout_id") REFERENCES "tryouts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_set_attempts" ADD CONSTRAINT "tryout_set_attempts_tryout_set_id_tryout_sets_id_fk" FOREIGN KEY ("tryout_set_id") REFERENCES "tryout_sets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_set_attempts" ADD CONSTRAINT "tryout_set_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_subjects" ADD CONSTRAINT "tryout_subjects_parent_id_tryout_subjects_id_fk" FOREIGN KEY ("parent_id") REFERENCES "tryout_subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "tryout_user_attempts" ADD CONSTRAINT "tryout_user_attempts_tryout_question_user_id_tryout_set_unique" UNIQUE("tryout_question","user_id","tryout_set");