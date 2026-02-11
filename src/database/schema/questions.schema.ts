import {
  boolean,
  integer,
  json,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { topics } from './topics.schema';
import { sql } from 'drizzle-orm';
import { subjects } from './subjects.schema';
import { Options } from './options.schema';

type QuestionContent = {
  content: string;
  asset_url: string;
}

export type Content = {
  content: string;
  isMedia: boolean;
}

export const questionTypes = pgEnum('question_types', [
  'multiple-choice',
  'fill-in',
  'table-choice',
  'multiple-answer'
]);

export const questions = pgTable('questions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  content: json('content').$type<QuestionContent>().notNull().default({
    content: '',
    asset_url: '',
  }),
  question: json('question').$type<Content[]>().notNull().default([]),
  answer: json('answer').$type<QuestionContent>().notNull().default({
    content: '',
    asset_url: '',
  }),
  answers: json('answers').$type<Content[]>().default([]), // move the answer to answers with the new format
  topic_id: uuid('topic_id').references(() => topics.id),
  subject_id: uuid('subject_id').references(() => subjects.id),
  is_verified: boolean('is_verified').default(false),
  year: integer('year').notNull(),
  source: varchar('source', {
    length: 20,
  }).notNull(),
  updated_at: timestamp('updated_at')
    .notNull()
    .default(sql`current_timestamp`),
  published: boolean('published').default(true),
  options: jsonb('options').$type<Options[]>().default([]),
  type: questionTypes('type').default('multiple-choice').notNull(),
  filledAnswer: jsonb('filled_answer').$type<string[]>().default([]),
});

export type  Question = typeof questions.$inferSelect;
export type QuestionType = typeof questionTypes