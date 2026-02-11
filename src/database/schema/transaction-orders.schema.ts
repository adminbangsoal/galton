import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { promos } from './promos.schema';
import { users } from './users.schema';
import { referralCode } from './referral.schema';

export const subscriptionsEnum = pgEnum('subscriptions_type', [
  'pemula',
  'ambis',
  'setia',
]);

export const transactionOrders = pgTable('transaction_orders', {
  id: text('id').primaryKey(),
  subscription_type: subscriptionsEnum('subscription_type').notNull(),
  referal: uuid('referal').references(() => referralCode.id),
  timestamp: timestamp('timestamp').defaultNow(),
  user_id: uuid('user_id')
    .references(() => users.id)
    .notNull(),
});

export const SubscriptionsType = transactionOrders.subscription_type.enumValues;
export type SubscriptionTypeEnum = typeof SubscriptionsType[number];
