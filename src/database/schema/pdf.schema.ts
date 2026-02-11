import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { subjects } from './subjects.schema';
import { topics } from './topics.schema';
import { users } from './users.schema';
import { sql } from 'drizzle-orm';

export const pdf = pgTable('pdf', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  filename: text('filename'),
  url: text('url'),
  subject_id: uuid('subject_id').references(() => subjects.id),
  topic_id: uuid('topic_id').references(() => topics.id),
  generated_url: text('generated_url'),
  user_id: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  timestamp: timestamp('timestamp')
    .notNull()
    .default(sql`now()`),
});
