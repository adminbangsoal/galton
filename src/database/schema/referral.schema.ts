import { sql } from "drizzle-orm";
import { boolean, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "./users.schema";
import { transactionOrders } from "./transaction-orders.schema";

export const referralCode = pgTable("referral_code", {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    code: varchar("code", { length: 20 }).notNull(),
    partnerName: varchar("partner_name", { length: 100 }).notNull(),
    discount: integer("discount").notNull(),
    expiredAt: timestamp("expired_at").notNull(),
    isActive: boolean("is_active").default(false),
    maxUsage: integer("max_usage"),
    createdAt: timestamp("created_at").defaultNow(),
})

export const referralUsage = pgTable("referral_usage", {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    referral_code: uuid("referral_code").references(() => referralCode.id).notNull(),
    userId: uuid("user_id").references(() => users.id).notNull(),
    orderId: text("order_id").references(() => transactionOrders.id, { onDelete: 'cascade' }).notNull(),
})