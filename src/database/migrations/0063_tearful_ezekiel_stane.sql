CREATE TABLE IF NOT EXISTS "extracted_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_url" text NOT NULL,
	"url" text NOT NULL,
	"extracted_content" text
);
