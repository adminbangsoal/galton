DO $$ BEGIN
 CREATE TYPE "tryout_generator_code" AS ENUM('english', 'math', 'indonesia');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "tryout_subjects" ADD COLUMN "generator_code" "tryout_generator_code" NOT NULL;