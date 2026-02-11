import { sql } from 'drizzle-orm';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const extractedContent = pgTable('extracted_content', {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    sourceUrl: text('source_url').notNull(),
    url: text('url').notNull(),
    extractedContent: text('extracted_content'),
    createdAt: text('created_at').notNull().default(sql`now()`),
    updatedAt: text('updated_at').notNull().default(sql`now()`),
})