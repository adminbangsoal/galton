CREATE TABLE IF NOT EXISTS "update_modals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(60) NOT NULL,
	"content" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"expired_at" timestamp DEFAULT now() NOT NULL,
	"image_url" text,
	"redirect_url" text,
	"button_name" varchar(20),
	"button_url" text
);
