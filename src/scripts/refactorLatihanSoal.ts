/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */

import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import { questions, options, Options } from '../database/schema';
import { eq } from 'drizzle-orm';

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);

const db = drizzle(pg, {
  schema: {
    questions,
    options,
  },
});

const run = async () => {
  const opts = await db.select().from(options).execute();
  const quests = await db.select().from(questions).execute();

  let counter = 0;

  // migrate the options
  for (let i = 0; i < opts.length; i++) {
    const opt = opts[i];
    console.log(`Migrating options ${counter + 1} of ${opts.length}`);
    const options = opt.options;

    const newOptions: Options[] = [];

    for (let j = 0; j < options.length; j++) {
      const option = options[j];

      newOptions.push({
        content: option.content,
        id: option.id,
        is_true: option.is_true,
        key: option.key,
        asset: option.asset,
      });
    }

    await db
      .update(questions)
      .set({
        options: newOptions,
      })
      .where(eq(questions.id, opt.question_id))
      .execute();

    counter++;
  }

  // migrate the questions
  for (let i = 0; i < quests.length; i++) {
    const question = quests[i];
    const content = question.content;
    const answer = question.answer;

    const newQuestion = [];
    newQuestion.push({
      content: content.content,
      isMedia: false,
    });

    const newAnswer = [];
    newAnswer.push({
      content: answer.content,
      isMedia: false,
    });

    if (content.asset_url) {
      newQuestion.push({
        content: content.asset_url,
        isMedia: true,
      });
    }

    if (answer.asset_url) {
      newAnswer.push({
        content: answer.asset_url,
        isMedia: true,
      });
    }

    await db
      .update(questions)
      .set({
        question: newQuestion,
        answers: newAnswer,
      })
      .where(eq(questions.id, question.id))
      .execute();

    console.log(`Migrating question ${i + 1} of ${quests.length}`);
  }
};

run()
  .then(() => {
    console.log('Migration success');
    pg.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    pg.end();
    process.exit(1);
  });
