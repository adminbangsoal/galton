import { sql } from 'drizzle-orm';
import {
  bigint,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { subjects } from './subjects.schema';
import { topics } from './topics.schema';
import { users } from './users.schema';

export const noteTypeEnum = pgEnum('note_type', [
  'catatan',
  'pembahasan',
  'slide',
  'presentasi',
  'cheatsheet',
  'coretan',
  'tugas',
  'ujian',
  'lainnya',
]);

export const bangCatatanThemeEnum = pgEnum('bang_catatan_theme', [
  'gray',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'cyan',
  'teal',
  'sky',
  'blue',
  'indigo',
  'purple',
  'violet',
  'rose',
  'pink',
  'fuchsia',
  'rose',
]);

export const bangCatatan = pgTable('bang_catatan', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  asset_url: text('asset_url').notNull(),
  title: varchar('title', {
    length: 255,
  }).notNull(),
  description: text('description').notNull(),
  thumbnail_url: text('thumbnail_url').notNull(),
  color_pallete: bangCatatanThemeEnum('theme').notNull(),
  subject_id: uuid('subject_id')
    .references(() => subjects.id)
    .notNull(),
  topic_id: uuid('topic_id') // dependent on subject
    .references(() => topics.id)
    .notNull(),
  note_type: noteTypeEnum('note_type').notNull(),
  user_id: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  like_count: bigint('like_count', {
    mode: 'number',
  })
    .notNull()
    .default(0),
  download_count: bigint('download_count', {
    mode: 'number',
  })
    .notNull()
    .default(0),
  created_at: timestamp('created_at').defaultNow(),
});

export const bangCatatanReport = pgTable('bang_catatan_report', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  reason: text('reason').notNull(),
  catatan_id: uuid('catatan_id')
    .references(() => bangCatatan.id)
    .notNull(),
  user_id: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  created_at: timestamp('created_at').defaultNow(),
});
