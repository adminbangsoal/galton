DO $$ BEGIN
 CREATE TYPE "bang_catatan_theme" AS ENUM('gray', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'cyan', 'teal', 'sky', 'blue', 'indigo', 'purple', 'violet', 'rose', 'pink', 'fuchsia');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "tipe" AS ENUM('catatan', 'pembahasan', 'slide', 'presentasi', 'cheatsheet', 'coretan', 'tugas', 'ujian', 'lainnya');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "subscriptions_type" AS ENUM('pemula', 'ambis', 'setia');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bang_catatan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_url" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" varchar(300) NOT NULL,
	"thumbnail_url" text NOT NULL,
	"theme" "bang_catatan_theme" NOT NULL,
	"subject_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"tipe" "tipe" NOT NULL,
	"user_id" uuid NOT NULL,
	"like_count" bigint DEFAULT 0 NOT NULL,
	"saved_count" bigint DEFAULT 0 NOT NULL,
	"download_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flashcard_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flashcard_id" uuid,
	"user_id" uuid,
	"user_answer" text[] NOT NULL,
	"start_time" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flashcards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_ids" text[] NOT NULL,
	"generated_time" timestamp DEFAULT now(),
	"timelimit" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leaderboard_backup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" text NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "log_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"document_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "log_point_histories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"document_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"options" jsonb DEFAULT '[{"id":"","content":"","key":"","is_true":false}]'::jsonb NOT NULL,
	CONSTRAINT "options_question_id_unique" UNIQUE("question_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(300) NOT NULL,
	"price_label" varchar(20) NOT NULL,
	"price" integer NOT NULL,
	"validity_day" integer NOT NULL,
	CONSTRAINT "packages_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "promos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(100) NOT NULL,
	"affiliator_id" uuid,
	"reduction" json NOT NULL,
	"expired_time" timestamp NOT NULL,
	"remaining_limit" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "promos_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "question_attempt_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_attempts_id" uuid NOT NULL,
	"asset_url" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "question_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid,
	"options_id" uuid,
	"choice" uuid NOT NULL,
	"answer_history" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" uuid,
	"submitted_time" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "question_feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"feedback" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"is_like" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" json DEFAULT '{"content":"","asset_url":""}'::json NOT NULL,
	"answer" json DEFAULT '{"content":"","asset_url":""}'::json NOT NULL,
	"topic_id" uuid,
	"subject_id" uuid,
	"is_verified" boolean DEFAULT false,
	"year" integer NOT NULL,
	"source" varchar(20) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"alternate_name" varchar(100) NOT NULL,
	"icon" varchar(250),
	CONSTRAINT "subjects_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"subject_id" uuid,
	CONSTRAINT "topics_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transaction_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"subscription_type" "subscriptions_type" NOT NULL,
	"referal_code" text,
	"timestamp" timestamp DEFAULT now(),
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"timestamp" timestamp DEFAULT now(),
	"metadata" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tryout_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tryout_id" uuid,
	"order_number" integer NOT NULL,
	"duration" bigint NOT NULL,
	"subject_id" uuid,
	CONSTRAINT "tryout_batches_id_order_number_unique" UNIQUE("id","order_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tryout_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tryout_id" uuid,
	"question_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tryout_user_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tryout_id" uuid,
	"user_answer" json DEFAULT '[]',
	"user_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tryouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"end_time" timestamp NOT NULL,
	"base_point" json DEFAULT '{
        "correct": 20,
        "incorrect": 5
    }',
	"logo_src" varchar DEFAULT '',
	"description" varchar(300) NOT NULL,
	CONSTRAINT "tryouts_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" varchar(255),
	"highschool" varchar(120),
	"highschool_year" varchar(10),
	"choosen_uni_one" varchar(120),
	"choosen_major_one" varchar(50),
	"choosen_uni_two" varchar(120),
	"choosen_major_two" varchar(50),
	"choosen_uni_three" varchar(120),
	"choosen_major_three" varchar(50),
	"phone_number" varchar(20) NOT NULL,
	"email" varchar(255),
	"referral_code" varchar(100),
	"profile_img" text DEFAULT 'https://bangsoal.s3.ap-southeast-1.amazonaws.com/static/user.svg',
	"source" varchar DEFAULT 'website',
	"onboard_date" timestamp,
	"is_email_verified" boolean DEFAULT false,
	"validity_date" timestamp DEFAULT now(),
	"register_referal_code" varchar(10) DEFAULT null
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bang_catatan" ADD CONSTRAINT "bang_catatan_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bang_catatan" ADD CONSTRAINT "bang_catatan_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bang_catatan" ADD CONSTRAINT "bang_catatan_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flashcard_attempts" ADD CONSTRAINT "flashcard_attempts_flashcard_id_flashcards_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "flashcards"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "flashcard_attempts" ADD CONSTRAINT "flashcard_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "log_activities" ADD CONSTRAINT "log_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "log_point_histories" ADD CONSTRAINT "log_point_histories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "options" ADD CONSTRAINT "options_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "promos" ADD CONSTRAINT "promos_affiliator_id_users_id_fk" FOREIGN KEY ("affiliator_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "question_attempt_assets" ADD CONSTRAINT "question_attempt_assets_question_attempts_id_question_attempts_id_fk" FOREIGN KEY ("question_attempts_id") REFERENCES "question_attempts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_options_id_options_id_fk" FOREIGN KEY ("options_id") REFERENCES "options"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "questions" ADD CONSTRAINT "questions_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "topics" ADD CONSTRAINT "topics_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction_orders" ADD CONSTRAINT "transaction_orders_referal_code_promos_code_fk" FOREIGN KEY ("referal_code") REFERENCES "promos"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transaction_orders" ADD CONSTRAINT "transaction_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_order_id_transaction_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "transaction_orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_batches" ADD CONSTRAINT "tryout_batches_tryout_id_tryouts_id_fk" FOREIGN KEY ("tryout_id") REFERENCES "tryouts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_batches" ADD CONSTRAINT "tryout_batches_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_questions" ADD CONSTRAINT "tryout_questions_tryout_id_tryout_batches_id_fk" FOREIGN KEY ("tryout_id") REFERENCES "tryout_batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_questions" ADD CONSTRAINT "tryout_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_user_attempts" ADD CONSTRAINT "tryout_user_attempts_tryout_id_tryouts_id_fk" FOREIGN KEY ("tryout_id") REFERENCES "tryouts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_user_attempts" ADD CONSTRAINT "tryout_user_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
