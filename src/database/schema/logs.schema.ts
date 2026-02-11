import { pgTable, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { sql } from 'drizzle-orm';

export const log_activities = pgTable('log_activities', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').references(() => users.id),
  document_id: uuid('document_id').notNull(),
});

export const log_point_histories = pgTable('log_point_histories', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  user_id: uuid('user_id').references(() => users.id),
  document_id: uuid('document_id').notNull(),
});
