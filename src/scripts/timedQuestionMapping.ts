/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */

import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import { subjects, timed_questions_time_mapping } from '../database/schema';

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);
const db = drizzle(pg, {
  schema: {
    subjects,
    timed_questions_time_mapping,
  },
});

// in seconds
const TIME_MAPPING = {
  PBM: 1200,
  PPU: 900,
  PU: 1800,
  PKPM: 1200,
  'Literasi dalam Bahasa Indonesia': 2700,
  'Literasi dalam Bahasa Inggris': 1800,
};

const run = async () => {
  console.log('Running script timed question mapping...');

  const subject = await db.select().from(subjects).execute();

  for (let i = 0; i < subject.length; i++) {
    const alternateName = subject[i].alternate_name;

    await db
      .insert(timed_questions_time_mapping)
      .values({
        subjectId: subject.find((t) => t.alternate_name == alternateName).id,
        timeLimit: TIME_MAPPING[alternateName],
      })
      .onConflictDoNothing()
      .execute();
  }
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
