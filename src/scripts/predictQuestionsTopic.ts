import axios from 'axios';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import {
  questions,
  subjects,
  topics,
  tempQuestionSubject,
} from '../../src/database/schema';
import { and, notInArray } from 'drizzle-orm';

type PredictResponse = {
  data: {
    type: string;
    subtype: string;
    description: string;
  };
};

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);

const db = drizzle(pg, {
  schema: {
    questions,
    tempQuestionSubject,
    subjects,
    topics,
  },
});

const run = async () => {
  console.log('Running Predict Questions Topic Script...');

  const questionAlreadyRunned = await db.query.tempQuestionSubject.findMany({
    columns: {
      questionId: true,
    },
  });

  const questionIds = questionAlreadyRunned.map(
    (question) => question.questionId,
  );

  const questionsQuery = await db.query.questions.findMany({
    where:
      questionIds.length > 0
        ? notInArray(questions.id, questionIds)
        : undefined,
  });

  const subjectsQuery = await db.query.subjects.findMany({
    columns: {
      id: true,
      name: true,
    },
  });
  const topicsQuery = await db.query.topics.findMany({
    columns: {
      id: true,
      name: true,
      subject_id: true,
    },
  });

  console.log(`Got ${questionsQuery.length} questions from database:`);

  for (const question of questionsQuery) {
    if (question.content.asset_url) {
      console.log(`Skipping question with asset_url: ${question.id}`);
      continue;
    }

    console.log(`Predicting topic for question: ${question.id}`);

    const { data } = await axios.post<PredictResponse>(
      'https://ai.bangsoal.co/predict-type-task',
      {
        question: question.content.content,
        main_type: 'undecided',
      },
      {
        headers: {
          'access-key': process.env.BANGSOAL_AI_API_KEY,
        },
      },
    );
    console.log(
      '=============================================================',
    );

    console.log(
      'Successfully predicted topic for question:',
      question.id,
      data,
    );

    console.log(
      '=============================================================',
    );

    console.log('INSERTING TO TEMP QUESTION SUBJECT...');

    let newSubject = subjectsQuery.find(
      (subject) => subject.name.toLowerCase() === data.data.type.toLowerCase(),
    );

    if (!newSubject) {
      console.log(`Creating new subject: ${data.data.type}`);

      // create the new subject
      const newSubjectQuery = await db
        .insert(subjects)
        .values({
          name: data.data.type,
          alternate_name: data.data.type,
        })
        .returning();

      newSubject = {
        id: newSubjectQuery[0].id,
        name: newSubjectQuery[0].name,
      };

      subjectsQuery.push(newSubject);

      console.log(`Inserted new subject: ${newSubject.name}`);
    }

    let newTopic = topicsQuery.find(
      (topic) =>
        topic.name.toLowerCase() === data.data.subtype.toLowerCase() &&
        topic.subject_id === newSubject.id,
    );

    if (!newTopic) {
      console.log(
        `Creating new topic: ${data.data.subtype} for subject: ${data.data.type}`,
      );

      // create the new topic
      const newTopicQuery = await db
        .insert(topics)
        .values({
          name: data.data.subtype,
          subject_id: newSubject.id,
        })
        .returning();

      newTopic = {
        id: newTopicQuery[0].id,
        name: newTopicQuery[0].name,
        subject_id: newTopicQuery[0].subject_id,
      };
      topicsQuery.push(newTopic);

      console.log(
        `Inserted new topic: ${newTopic.name} for subject: ${newSubject.name}`,
      );
    }

    // insert to tempQuestionSubject
    await db.insert(tempQuestionSubject).values({
      newSubjectName: data.data.type,
      newTopicName: data.data.subtype,
      predictionDescription: data.data.description,
      oldSubjectId: question.subject_id,
      oldSubjectName: subjectsQuery.find(
        (subject) => subject.id === question.subject_id,
      )?.name as string,
      oldTopicId: question.topic_id,
      questionId: question.id,
      oldTopicName: topicsQuery.find((topic) => topic.id === question.topic_id)
        ?.name as string,
      timestamp: new Date().toISOString(),
      newSubjectId: newSubject.id,
      newTopicId: newTopic.id,
    });

    console.log('INSERTED TO TEMP QUESTION SUBJECT');
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
