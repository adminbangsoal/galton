/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */

import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import {
  subjects,
  topics,
  questions as questionSchema,
  options,
  packages,
  question_attempts,
  questions,
} from '../database/schema';
import { eq, inArray } from 'drizzle-orm';

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);
const db = drizzle(pg, {
  schema: {
    subjects,
    topics,
    questionSchema,
    options,
    packages,
  },
});

const run = async () => {
  console.log('Running script delete invalid questions...');

  await db.transaction(async (db) => {
    const r = [];
    const qIdsToDelete = [];

    const opts = await db.select().from(options).execute();
    const invalidOptions = opts.filter((opt) => opt.options.length < 5);

    r.push(...invalidOptions.map((opt) => opt.id));
    qIdsToDelete.push(...invalidOptions.map((opt) => opt.question_id));

    // delete question attempt
    await db
      .delete(question_attempts)
      .where(inArray(question_attempts.question_id, qIdsToDelete))
      .execute();
    // delete options
    await db.delete(options).where(inArray(options.id, r)).execute();
    // delete questions
    await db
      .delete(questions)
      .where(inArray(questions.id, qIdsToDelete))
      .execute();
  });
};

run()
  .then(() => {
    console.log('Script done');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    console.log('Seeding failed');
    process.exit(1);
  });
