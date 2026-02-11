ALTER TABLE "tryout_attempts" ADD COLUMN "current_tryout_set_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_attempts" ADD CONSTRAINT "tryout_attempts_current_tryout_set_id_tryout_sets_id_fk" FOREIGN KEY ("current_tryout_set_id") REFERENCES "tryout_sets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
