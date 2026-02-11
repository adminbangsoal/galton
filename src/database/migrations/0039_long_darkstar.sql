DO $$ BEGIN
 CREATE TYPE "note_type" AS ENUM('catatan', 'pembahasan', 'slide', 'presentasi', 'cheatsheet', 'coretan', 'tugas', 'ujian', 'lainnya');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bang_catatan_report" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reason" text NOT NULL,
	"catatan_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bang_catatan" DROP COLUMN IF EXISTS "tipe";--> statement-breakpoint
ALTER TABLE "bang_catatan" DROP COLUMN IF EXISTS "saved_count";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bang_catatan_report" ADD CONSTRAINT "bang_catatan_report_catatan_id_bang_catatan_id_fk" FOREIGN KEY ("catatan_id") REFERENCES "bang_catatan"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bang_catatan_report" ADD CONSTRAINT "bang_catatan_report_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
