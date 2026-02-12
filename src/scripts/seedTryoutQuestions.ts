/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */

import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import { tryout_questions, tryout_subjects } from '../database/schema';

export type TryoutQuestion = {
  id: string;
  tryout_set_id: string;
  content: string;
  content_image: string;
  options: string;
  is_text_answer: boolean;
  created_at: string;
  source: string;
  question_id: string;
};

const tryoutSetMapping = {
  '34abb710-c78d-47a7-b74a-9ad70705f084':
    '7a32e4fe-89fd-4445-a28b-72ce2470b942',
  '7d42b563-f5f6-492e-866a-e4c6c9f3456f':
    '65a14bc9-f480-4004-bd54-77434f204cc4',
  'deb41693-6fb2-46d5-8208-555daae04eca':
    '4ef6e434-628f-48d7-a7de-771c753016d5',
  'e7f0b795-b5be-42d8-bb2b-10e22450c647':
    'b489ea1b-95cf-4edc-a4f1-26982d6aabeb',
  '96a185c0-bfd6-425d-a50a-455babe5fa62':
    'cc8c1f8e-decb-4c90-85ba-802cc05c9301',
  'b205da91-99f4-41db-b8a6-407d1fd4531b':
    '69df6169-8d00-42f0-a720-2d0103a190ad',
  'a3c950e3-c339-4a97-a984-4681a5bf3a7d':
    'd3bf3232-42b7-4fde-9d17-5e2bd5f849fa',
};

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);
const db = drizzle(pg, {
  schema: {
    tryout_subjects,
  },
});

const run = async () => {
  const data: TryoutQuestion[] = await import('./data/tryout_questions.json');

  await db.transaction(async (trx) => {
    const d = [];

    for (const question of data) {
      const tryoutSetId: string = tryoutSetMapping[question.tryout_set_id];
      if (!tryoutSetId) {
        throw new Error(`Tryout set id ${question.tryout_set_id} not found`);
      }

      const newQuestion = {
        id: question.id,
        tryoutSetId,
        content: question.content,
        contentImage: question.content_image,
        options: JSON.parse(question.options),
        isTextAnswer: question.is_text_answer,
        createdAt: new Date(question.created_at),
        source: question.source,
        questionId: question.question_id,
      };
      d.push(newQuestion);
    }

    try {
      await trx.insert(tryout_questions).values(d).execute();
    } catch (err) {
      console.error(err);
    }
  });
};

run()
  .then(() => {
    console.log('Dones');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
