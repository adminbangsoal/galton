ALTER TABLE "questions" ADD COLUMN "updated_at" timestamp DEFAULT current_timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "published" boolean DEFAULT true;