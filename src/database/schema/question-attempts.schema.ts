import { sql } from 'drizzle-orm';
import {
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { questions } from './questions.schema';
import { users } from './users.schema';
import { timed_questions } from './timed-questions.schema';

export const question_attempts = pgTable(
  'question_attempts',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    question_id: uuid('question_id').references(() => questions.id),
    choice_id: uuid('choice'),
    answer_history: text('answer_history').notNull(), // for fallback
    timestamp: timestamp('timestamp')
      .notNull()
      .default(sql`now()`),
    user_id: uuid('user_id').references(() => users.id),
    submitted: timestamp('submitted_time'),
    timed_questions_id: uuid('timed_questions_id').references(
      () => timed_questions.id,
    ),
    filledAnswers: jsonb('filled_answers').$type<string[]>().default([]),
  },
  (t) => ({
    unq: unique().on(t.timed_questions_id, t.question_id),
  }),
);

export const question_attempt_assets = pgTable('question_attempt_assets', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  question_attempts_id: uuid('question_attempts_id')
    .references(() => question_attempts.id)
    .notNull(),
  asset_url: varchar('asset_url').notNull(),
});

export type QuestionAttempt = typeof question_attempts.$inferSelect;
