import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const tryout_registrations = pgTable(
  'tryout_registrations',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    user_id: uuid('user_id').notNull(),
    tryout_id: uuid('tryout_id').notNull(),
    created_at: timestamp('created_at').defaultNow(),
    first_task_submission: text('first_task_submission').default(''),
    second_task_submission: text('second_task_submission').default(''),
    third_task_submission: text('third_task_submission').default(''),
  },
  (t) => ({
    unq: unique().on(t.user_id, t.tryout_id),
  }),
);
