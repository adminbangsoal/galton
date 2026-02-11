ALTER TABLE "questions" ADD COLUMN "question" json DEFAULT '[]'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "answers" json DEFAULT '[]'::json;