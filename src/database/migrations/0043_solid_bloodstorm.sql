ALTER TABLE "tryout_sets" ALTER COLUMN "tryout_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tryout_sets" ADD COLUMN "next_set" uuid;--> statement-breakpoint
ALTER TABLE "tryouts" ADD COLUMN "first_set_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryout_sets" ADD CONSTRAINT "tryout_sets_next_set_tryout_sets_id_fk" FOREIGN KEY ("next_set") REFERENCES "tryout_sets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tryouts" ADD CONSTRAINT "tryouts_first_set_id_tryout_sets_id_fk" FOREIGN KEY ("first_set_id") REFERENCES "tryout_sets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
