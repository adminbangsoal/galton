import { sql } from 'drizzle-orm';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const leaderboard_backup = pgTable('leaderboard_backup', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  timestamp: text('timestamp').notNull(),
  url: text('url').notNull(),
});
