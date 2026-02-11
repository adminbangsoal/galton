ALTER TABLE "tryout_question_attempts" ALTER COLUMN "filled_answers" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "extracted_content" ADD COLUMN "created_at" text DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "extracted_content" ADD COLUMN "updated_at" text DEFAULT now() NOT NULL;