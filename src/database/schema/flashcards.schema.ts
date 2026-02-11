import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { bigint } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const flashcards = pgTable('flashcards', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  question_ids: text('question_ids').array().notNull(),
  generated_time: timestamp('generated_time').defaultNow(),
  timelimit: bigint('timelimit', {
    mode: 'bigint',
  }).notNull(),
});

export const flashcardAttempts = pgTable('flashcard_attempts', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  flashcard_id: uuid('flashcard_id').references(() => flashcards.id),
  user_id: uuid('user_id').references(() => users.id),
  user_answer: text('user_answer').array().notNull(),
  start_time: timestamp('start_time').defaultNow(),
});
