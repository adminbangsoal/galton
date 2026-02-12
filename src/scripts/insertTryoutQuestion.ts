import { eq, and, sql, inArray, gte, ne, notInArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import { tryout_questions } from '../../src/database/schema';
import * as toQuestions from './data/insert_tryout_prod.json';

const dotenv = require('dotenv');
dotenv.config();

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, {
  schema: {
    tryout_questions,
  },
});

const run = async () => {
  console.log('Running Insert Tryout Question Script...');
  const parsedData = [];
  // parse options & explanations
  for (const d of toQuestions) {
    let options = d.options;

    if (typeof d.options === 'string') {
      options = JSON.parse(d.options);
    }

    let explanations = d.explanations;

    if (typeof d.explanations === 'string') {
      explanations = JSON.parse(d.explanations);
    }

    let answers = d.answers;

    if (typeof d.answers === 'string') {
      answers = JSON.parse(d.answers);
    }

    parsedData.push({
      ...d,
      options,
      explanations,
      answers,
    });
  }

  await db.insert(tryout_questions).values(parsedData).returning().execute();

  console.log('Insert Tryout Question Script Finished');
};

run()
  .then(() => {
    console.log('done');
    process.exit(0);
  })
  .catch((e) => {
    console.log('error', e);
    process.exit(1);
  });
