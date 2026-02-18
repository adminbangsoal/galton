import { boolean, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { transactions } from './transactions.schema';

export const subscriptionsTypeEnum = pgEnum('subscriptions_type', [
  'pemula',
  'ambis',
  'setia',
]);

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  user_id: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  subscription_type: subscriptionsTypeEnum('subscription_type').notNull(),
  transaction_id: text('transaction_id')
    .references(() => transactions.id)
    .notNull(),
  payment_date: timestamp('payment_date').defaultNow().notNull(),
  expired_date: timestamp('expired_date').notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
