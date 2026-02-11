import { sql } from 'drizzle-orm';
import { pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';

export const subjects = pgTable('subjects', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', {
    length: 100,
  })
    .notNull()
    .unique(),
  alternate_name: varchar('alternate_name', {
    length: 100,
  }).notNull(),
  icon: varchar('icon', {
    length: 250,
  }),
  slug: varchar('slug', {
    length: 50
  }).unique(),
  illustration: text('background_illustration'),
  year: varchar('year', {
    length: 4
  })
});

export type Subjects = typeof subjects.$inferSelect;
