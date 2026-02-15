/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { tryout_subjects } from '../database/schema';

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);
const db = drizzle(pg, {
  schema: {
    tryout_subjects,
  },
});

const run = async () => {
  await db
    .insert(tryout_subjects)
    .values([
      {
        name: 'Penalaran Umum',
        questionsLimit: 30,
        generatorCode: 'math',
      },
      {
        name: 'Pengetahuan dan Pemahaman Umum',
        questionsLimit: 15,
        generatorCode: 'math',
      },
      {
        name: 'Pemahaman Bacaan dan Menulis',
        questionsLimit: 25,
        generatorCode: 'indonesia',
      },
      {
        name: 'Penalaran Kuantitatif',
        questionsLimit: 20,
        generatorCode: 'math',
      },
      {
        name: 'Penalaran Matematika',
        questionsLimit: 30,
        generatorCode: 'math',
      },
      {
        name: 'Bahasa Indonesia',
        questionsLimit: 45,
        generatorCode: 'indonesia',
      },
      {
        name: 'Bahasa Inggris',
        questionsLimit: 30,
        generatorCode: 'english',
      },
    ])
    .onConflictDoNothing()
    .execute();
};

run()
  .then(() => {
    console.log('Script done');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
