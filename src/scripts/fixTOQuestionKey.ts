/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { tryout_questions } from '../database/schema';
import { eq } from 'drizzle-orm';

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);
const db = drizzle(pg, {
  schema: {
    tryout_questions,
  },
});

const main = async () => {
  // Get All tryout questions
  const tryoutQuestions = await db.select().from(tryout_questions).execute();

  // Update all questions
  for (let i = 0; i < tryoutQuestions.length; i++) {
    const toQuestion = tryoutQuestions[i];
    const options = toQuestion.options;
    // change key from 'isTrue' to 'isTrue'
    for (let j = 0; j < options.length; j++) {
      let is_true = null;
      if (options[j]['isTrue']) {
        is_true = options[j]['isTrue'];
        delete options[j]['isTrue'];
      }
      if (is_true) {
        // update to database
        await db
          .update(tryout_questions)
          .set({ options: options })
          .where(eq(tryout_questions.id, toQuestion.id))
          .execute();
        console.log(`Updated question with id: ${toQuestion.id}`);
      }
    }
  }
};

main()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
