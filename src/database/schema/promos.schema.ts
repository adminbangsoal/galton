import { integer, timestamp, uuid } from 'drizzle-orm/pg-core';
import { json, pgTable, varchar } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { sql } from 'drizzle-orm';

export type PromosReductionType = {
  type: 'percentage' | 'fixed';
  value: number;
};

export const promos = pgTable('promos', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  code: varchar('code', {
    length: 100,
  })
    .notNull()
    .unique(),
  affiliator_id: uuid('affiliator_id').references(() => users.id),
  reduction: json('reduction').$type<PromosReductionType>().notNull(),
  expired_time: timestamp('expired_time').notNull(),
  remaining_limit: integer('remaining_limit').default(0).notNull(),
});
