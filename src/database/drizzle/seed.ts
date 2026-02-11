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
} from '../schema';
import * as crypto from 'crypto';
import { eq } from 'drizzle-orm';
import axios from 'axios';

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

const SUBJECT_ICON_MAPPING = {
  PKPM: 'https://bangsoal.s3.ap-southeast-1.amazonaws.com/static/pk.png',
  PBM: 'https://bangsoal.s3.ap-southeast-1.amazonaws.com/static/pbm.png',
  PPU: 'https://bangsoal.s3.ap-southeast-1.amazonaws.com/static/brain.png',
  'Literasi dalam Bahasa Inggris':
    'https://bangsoal.s3.ap-southeast-1.amazonaws.com/static/pbm.png',
  PU: 'https://bangsoal.s3.ap-southeast-1.amazonaws.com/static/brain.png',
  'Literasi dalam Bahasa Indonesia':
    'https://bangsoal.s3.ap-southeast-1.amazonaws.com/static/pbm.png',
};

const run = async () => {
  console.log('Start seeding database...');

  console.log('Seeding subjects...');

  try {
    const { data } = await axios.get(`${process.env.CMS_URL}/subject`);

    const subs = [];

    for (let i = 0; i < data.data.length; i++) {
      subs.push({
        id: data.data[i].id,
        name: data.data[i].name,
        icon: SUBJECT_ICON_MAPPING[
          data.data[i].alternate_name as keyof typeof SUBJECT_ICON_MAPPING
        ],
        alternate_name: data.data[i].alternate_name,
      });
    }

    await db.insert(subjects).values(subs);
  } catch (err) {
    if (err.code === '23505') {
      console.log('Subjects already seeded');
    } else {
      console.log(err);
    }
  }

  try {
    console.log('Seeding topics...');

    const { data } = await axios.get(`${process.env.CMS_URL}/topic`);
    console.log(`Found ${data.data.length} topics`);
    const topics_result = [];

    for (const subject of data.data) {
      for (const topic of subject.topics) {
        topics_result.push({
          id: topic.id,
          name: topic.name,
          subject_id: subject.subject.id,
        });
      }
    }
    await db.insert(topics).values(topics_result);
  } catch (err) {
    if (err.code === '23505') {
      console.log('Topics already seeded');
    } else {
      console.log(err);
    }
  }

  console.log('Seeding questions...');
  const questions = [];

  const { data } = await axios.get(
    `${process.env.CMS_URL}/soal/all` || 'http://localhost:8080/api/soal/all',
  );

  await db.delete(question_attempts).execute();

  await db.delete(options).execute();

  await db.delete(questionSchema).execute();

  console.log(`Found ${data.data.length} questions`);
  const topicIds = await db.select().from(topics).execute();

  for (const soal of data.data) {
    const content = soal.content;
    const topicId = soal.topic_id;
    const answer = soal.answer;
    const year = soal.SoalSource.year;
    const sourceLabel = soal.SoalSource.name;

    const subjectId = topicIds.find(
      (topic) => topic.id === topicId,
    )?.subject_id;

    if (!subjectId) {
      console.error('Subject not found', topicId);
      continue;
    }

    questions.push({
      id: soal.id,
      content: {
        content,
        asset_url: soal.assets_url,
      },
      answer: {
        content: answer,
        asset_url: soal.answer_assets_url,
      },
      topic_id: topicId,
      subject_id: subjectId,
      year: year,
      source: sourceLabel,
    });
  }

  await db.insert(questionSchema).values(questions).onConflictDoNothing();

  console.log('Seeding options...');

  const { data: choicesData } = await axios.get(
    `${process.env.CMS_URL}/soal/choices` ||
      'http://localhost:8080/api/soal/choices',
  );

  await db.delete(options).execute();

  for (const choice of choicesData.data) {
    const content = choice.content;
    const questionId = choice.question_id;
    const is_correct = choice.is_correct;
    const key = choice.key;

    const opt = await db.query.options.findFirst({
      where: (option, { eq }) => eq(option.question_id, questionId),
    });

    if (opt) {
      const prevOptions = opt.options as any;
      const newOptions = [
        ...prevOptions,
        {
          id: crypto.randomUUID(),
          content,
          is_true: is_correct ? true : false,
          key,
        },
      ];

      await db
        .update(options)
        .set({
          options: newOptions.slice(0, 5),
        })
        .where(eq(options.question_id, questionId));
    } else {
      const isQuestionExist = await db.query.questionSchema.findFirst({
        where: (question, { eq }) => eq(question.id, questionId),
      });
      if (!isQuestionExist) {
        console.log('Question not exist', questionId);
        continue;
      }
      await db.insert(options).values({
        question_id: questionId,
        options: [
          {
            id: crypto.randomUUID(),
            content,
            is_true: is_correct ? true : false,
            key,
          },
        ],
      });
    }
  }

  console.log('Seeding Packages...');
  await db
    .insert(packages)
    .values([
      {
        name: 'Paket Hemat',
        description: 'Paket Hemat',
        price: 20000,
        price_label: '20.000',
        validity: 30,
      },
      {
        name: 'Paket Jagoan',
        description: 'Paket Jagoan',
        price: 55000,
        price_label: '55.000',
        validity: 60,
      },
      {
        name: 'Paket Juara',
        description: 'Paket Juara',
        price: 100000,
        price_label: '100.000',
        validity: 90,
      },
    ])
    .onConflictDoNothing();
};

run()
  .then(() => {
    console.log('Seeding done');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    console.log('Seeding failed');
    process.exit(1);
  });
