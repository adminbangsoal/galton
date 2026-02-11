import { sql } from 'drizzle-orm';
import { boolean, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { pgTable } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  full_name: varchar('full_name', {
    length: 255,
  }),
  highschool: varchar('highschool', {
    length: 120,
  }),
  highschool_year: varchar('highschool_year', {
    length: 10,
  }),
  choosen_university_one: text('choosen_uni_one'),
  choosen_major_one: text('choosen_major_one'),
  choosen_university_two: text('choosen_uni_two'),
  choosen_major_two: text('choosen_major_two'),
  choosen_university_three: text('choosen_uni_three'),
  choosen_major_three: text('choosen_major_three'),
  phone_number: varchar('phone_number', {
    length: 20,
  }).unique(),
  email: varchar('email', {
    length: 255,
  }).unique(),
  referral_code: varchar('referral_code', {
    length: 100,
  }),
  profile_img: text('profile_img').default(
    'https://bangsoal.s3.ap-southeast-1.amazonaws.com/static/user.svg',
  ),
  source: varchar('source').default('website'),
  onboard_date: timestamp('onboard_date'),
  is_email_verified: boolean('is_email_verified').default(false),
  validity_date: timestamp('validity_date').defaultNow(),
  register_referal_code: varchar('register_referal_code', {
    length: 10,
  }).default(null),
  password: text('password'),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
