import { sql } from 'drizzle-orm';
import {
  integer,
  json,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { subjects } from './subjects.schema';
import { questions } from './questions.schema';

export const timedQuestionEnum = pgEnum('timed_question_enum', [
  'sequential',
  'classic',
]);

export const timed_questions = pgTable('timed_questions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  submitted: timestamp('submitted_time'),
  mode: timedQuestionEnum('mode').default('classic').notNull(),
  createdAt: timestamp('created_at').default(sql`now()`),
  subjectId: uuid('subject_id').references(() => subjects.id),
  maxNumber: integer('max_number').notNull(),
  currentNumber: integer('current_number').default(0),
  questionIds: json('question_ids').$type<string[]>().notNull(),
  currentQuestion: uuid('current_question').references(() => questions.id),
});

export const timed_questions_time_mapping = pgTable(
  'timed_questions_time_mapping',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id)
      .unique(),
    timeLimit: integer('time_limit').notNull(),
    questionLimit: integer('question_limit').notNull().default(10),
  },
);

export const timed_questions_classic_questions = pgTable(
  'timed_questions_classic_questions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    timedQuestionId: uuid('timed_question_id')
      .references(() => timed_questions.id)
      .notNull(),
    questionIds: json('question_ids').$type<string[]>().notNull(),
    subjectId: uuid('subject_id')
      .references(() => subjects.id)
      .notNull(),
  },
);
