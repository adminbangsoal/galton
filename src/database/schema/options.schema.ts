import { sql } from 'drizzle-orm';
import { jsonb, pgTable, uuid } from 'drizzle-orm/pg-core';
import { questions } from './questions.schema';

export type Options = {
  id: string;
  content: string; // the value
  key: string; // a/b/c/d
  is_true: boolean;
  asset?: string;
};

export const options = pgTable('options', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  question_id: uuid('question_id')
    .references(() => questions.id)
    .notNull()
    .unique(),
  options: jsonb('options')
    .$type<Options[]>()
    .notNull()
    .default([
      {
        id: '',
        content: '',
        key: '',
        is_true: false,
      },
    ])
    .notNull(),
});
