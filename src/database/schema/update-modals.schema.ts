import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const update_modals = pgTable('update_modals', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: varchar('title', { length: 60 }).notNull(),
  content: text('content').notNull(),
  startedAt: timestamp('started_at')
    .notNull()
    .default(sql`now()`),
  expiredAt: timestamp('expired_at')
    .notNull()
    .default(sql`now()`),
  imageUrl: text('image_url'),
  redirectUrl: text('redirect_url'),
  buttonName: varchar('button_name', { length: 20 }),
  buttonUrl: text('button_url'),
});

