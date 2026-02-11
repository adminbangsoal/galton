ALTER TABLE "pdf" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "pdf" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "pdf" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pdf" ADD COLUMN "timestamp" timestamp DEFAULT now() NOT NULL;