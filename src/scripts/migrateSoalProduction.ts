import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  questions,
  tempQuestionSubject,
  subjects,
  topics,
} from '../../src/database/schema';
import { and, eq } from 'drizzle-orm';
import axios from 'axios';

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);

const db = drizzle(pg, {
  schema: {
    tempQuestionSubject,
    questions,
    subjects,
    topics,
  },
});

const run = async () => {
  //    PRODUCTION SOAL MIGRATE
  // 1. Change the subject name to be the latest (look at local db)
  // 2. Add UNDECIDED (subject & topic)
  // 3. Run NewTopicsSubjects Script
  // 4. Query question from staging temp_subject_question (run migrate soal production)
  // 5. Add the question time mapping
  // 6. Add year on subject
  // 7. Change Question Time Mapping Soal Limit per Subject
  // 8. Clean subject & topic with the latest format

  console.log('Running Migrate Latihan Soal Topics Scripts...');

  const questionsQuery = await db.query.questions.findMany({
    columns: {
      id: true,
      topic_id: true,
      subject_id: true,
    },
  });

  const questionsTempMapping = await axios.get<{
    statusCode: number;
    message: string;
    data: {
      [x: string]: {
        newSubjectId: string;
        newSubjectName: string;
        newTopicId: string;
        newTopicName: string;
        oldSubjectId: string;
        oldSubjectName: string;
        oldTopicName: string;
        questionId: string;
        oldTopicId: string;
      };
    }[];
  }>('https://api-dev.bangsoal.co.id/api/latihan-soal/temp-questions');

  const undecidedSubject = await db.query.subjects.findFirst({
    where: eq(subjects.name, 'UNDECIDED'),
  });

  const undecidedTopic = await db.query.topics.findFirst({
    where: and(
      eq(topics.name, 'UNDECIDED'),
      eq(topics.subject_id, undecidedSubject.id),
    ),
  });

  const subjectsQuery = await db.query.subjects.findMany({
    columns: {
      name: true,
      id: true,
    },
  });

  const subjectQueryMapping = {};

  // assign the subject id to the subject name
  for (let i = 0; i < subjectsQuery.length; i++) {
    subjectQueryMapping[subjectsQuery[i].name] = subjectsQuery[i].id;
  }

  for (let i = 0; i < questionsQuery.length; i++) {
    const tQuestion = questionsTempMapping.data.data[questionsQuery[i].id];

    if (tQuestion) {
      console.log(
        `Migrating question ${questionsQuery[i].id} to new topics and subjects...`,
      );

      // if subject not found, create one and also the topic
      if (!subjectQueryMapping[tQuestion.newSubjectName]) {
        console.log(`Creating new subject ${tQuestion.newSubjectName}...`);

        const newSubject = await db
          .insert(subjects)
          .values({
            name: tQuestion.newSubjectName,
            alternate_name: tQuestion.newSubjectName,
            year: '2025',
          })
          .returning()
          .execute();

        console.log(`Creating new topic ${tQuestion.newTopicName}...`);

        const newTopic = await db
          .insert(topics)
          .values({
            name: tQuestion.newTopicName,
            subject_id: newSubject[0].id,
          })
          .returning()
          .execute();

        await db
          .update(questions)
          .set({
            topic_id: newTopic[0].id,
            subject_id: newSubject[0].id,
          })
          .where(eq(questions.id, questionsQuery[i].id))
          .execute();
      } else {
        // check if the topic within the subject is not found, create one
        const topicQuery = await db.query.topics.findFirst({
          where: and(
            eq(topics.name, tQuestion.newTopicName),
            eq(
              topics.subject_id,
              subjectQueryMapping[tQuestion.newSubjectName],
            ),
          ),
        });

        if (!topicQuery) {
          console.log(
            `Creating new topic ${tQuestion.newTopicName}... for subject ${tQuestion.newSubjectName}`,
          );

          const newTopic = await db
            .insert(topics)
            .values({
              name: tQuestion.newTopicName,
              subject_id: subjectQueryMapping[tQuestion.newSubjectName],
            })
            .returning()
            .execute();

          await db
            .update(questions)
            .set({
              topic_id: newTopic[0].id,
              subject_id: subjectQueryMapping[tQuestion.newSubjectName],
            })
            .where(eq(questions.id, questionsQuery[i].id))
            .execute();
        } else {
          const updated = await db
            .update(questions)
            .set({
              topic_id: topicQuery.id,
              subject_id: subjectQueryMapping[tQuestion.newSubjectName],
            })
            .where(eq(questions.id, questionsQuery[i].id))
            .returning()
            .execute();

          console.log(
            `Updated question ${updated[0].id} to new subject: ${tQuestion.newSubjectName} and topic: ${tQuestion.newTopicName}`,
          );
        }
      }
    } else {
      // current question is not in the temp question subject, move it to undecided
      console.log(
        `Migrating question ${questionsQuery[i].id} to UNDECIDED subject...`,
      );

      await db
        .update(questions)
        .set({
          topic_id: undecidedTopic.id,
          subject_id: undecidedSubject.id,
        })
        .where(eq(questions.id, questionsQuery[i].id))
        .execute();
    }
  }
};

run()
  .then(() => {
    console.log('Migrate Latihan Soal Topics Scripts Done');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error running Migrate Latihan Soal Topics Scripts', err);
    process.exit(1);
  });
