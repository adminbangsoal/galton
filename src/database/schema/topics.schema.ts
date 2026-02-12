import { varchar } from 'drizzle-orm/pg-core';
import { pgTable, uuid, unique } from 'drizzle-orm/pg-core';
import { subjects } from './subjects.schema';
import { sql } from 'drizzle-orm';

export const topics = pgTable(
  'topics',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    name: varchar('name', {
      length: 100,
    }).notNull(),
    subject_id: uuid('subject_id').references(() => subjects.id),
  },
  (t) => ({
    unq: unique().on(t.name, t.subject_id),
  }),
);

export type Topics = typeof topics.$inferSelect;
