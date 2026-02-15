/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  tryout_subjects,
  tryout_pembahasan,
  tryout_questions,
  tryout_sets,
  tryout_set_attempts,
  tryout_question_attempts,
  tryout_attempts,
} from '../database/schema';
import { TryoutQuestion } from './seedTryoutQuestions';
import { eq, ne } from 'drizzle-orm';

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);
const db = drizzle(pg, {
  schema: {
    tryout_subjects,
    tryout_pembahasan,
    tryout_questions,
    tryout_sets,
    tryout_question_attempts,
    tryout_set_attempts,
    tryout_attempts,
  },
});

const run = async () => {
  const tryoutId = 'd97fd716-14db-4992-a59c-4dd0bf6a6f7e';

  const tryoutSets = await db.query.tryout_sets.findMany({
    where: eq(tryout_sets.tryoutId, tryoutId),
  });

  // delete duplicated tryout questions for each set by its content

  for (const tryoutSet of tryoutSets) {
    const tryoutQuestions = await db.query.tryout_questions.findMany({
      where: eq(tryout_questions.tryoutSetId, tryoutSet.id),
    });

    const uniqueQuestions = new Set<string>();

    for (const tryoutQuestion of tryoutQuestions) {
      // check if attempted
      const questionAttempts = await db.query.tryout_question_attempts.findMany(
        {
          where: eq(
            tryout_question_attempts.tryoutQuestionId,
            tryoutQuestion.id,
          ),
        },
      );

      if (questionAttempts.length > 0) {
        continue;
      }

      if (uniqueQuestions.has(tryoutQuestion.content)) {
        await db
          .delete(tryout_questions)
          .where(eq(tryout_questions.id, tryoutQuestion.id));
      } else {
        uniqueQuestions.add(tryoutQuestion.content);
      }
    }
  }
};

run()
  .then(() => {
    console.log('Done executing script!');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
