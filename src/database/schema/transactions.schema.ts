import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { transactionOrders } from './transaction-orders.schema';

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey(),
  order_id: text('order_id')
    .references(() => transactionOrders.id)
    .notNull(),
  user_id: uuid('user_id').notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
  metadata: jsonb('metadata').notNull(),
});
