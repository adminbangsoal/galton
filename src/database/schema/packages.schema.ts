import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, integer } from 'drizzle-orm/pg-core';

export const packages = pgTable('packages', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', {
    length: 100,
  })
    .notNull()
    .unique(),
  description: varchar('description', {
    length: 300,
  }).notNull(),
  price_label: varchar('price_label', {
    length: 20,
  }).notNull(),
  price: integer('price').notNull(),
  validity: integer('validity_day').notNull(), // store as days
});
