import { sql } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const question_feedbacks = pgTable('question_feedbacks', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  question_id: uuid('question_id').notNull(),
  user_id: uuid('user_id').notNull(),
  feedback: text('feedback'),
  timestamp: timestamp('timestamp')
    .notNull()
    .default(sql`now()`),
  is_like: boolean('is_like').notNull(),
});
