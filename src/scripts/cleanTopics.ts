import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import {
  questions,
  subjects,
  tempQuestionSubject,
  topics,
} from '../../src/database/schema';
import { and, eq } from 'drizzle-orm';

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);

const db = drizzle(pg, {
  schema: {
    tempQuestionSubject,
    questions,
    topics,
    subjects,
  },
});

const run = async () => {
  console.log('Running Clean New Topics Mapping...');

  // get all of the topics
  // get all of the subjects
  // check if the correlated new_topic_id is not FK-ing to the new_subject_id
  // check the correspondent new_topic_id from new_subject_id
  // if the new_topic_id is not in the new_subject_id, create new record for topics FK-ing to the new_subject_id

  const tempQuestions = await db.query.tempQuestionSubject.findMany({
    columns: {
      id: true,
      newSubjectId: true,
      newSubjectName: true,
      newTopicId: true,
      newTopicName: true,
    },
  });

  const topicsQuery = await db.query.topics.findMany({
    columns: {
      id: true,
      name: true,
      subject_id: true,
    },
  });
  const subjectsQuery = await db.query.subjects.findMany({
    columns: {
      id: true,
      name: true,
    },
  });

  const topicsSubjectMapping = {};

  for (let i = 0; i < subjectsQuery.length; i++) {
    topicsSubjectMapping[subjectsQuery[i].id] = [];
  }

  for (let i = 0; i < topicsQuery.length; i++) {
    topicsSubjectMapping[topicsQuery[i].subject_id].push(topicsQuery[i].id);
  }

  for (let i = 0; i < tempQuestions.length; i++) {
    // is the topic includes in the subject?
    const tempQuestion = tempQuestions[i];
    const isTopicIncludesInNewSubject = topicsSubjectMapping[
      tempQuestion.newSubjectId
    ].includes(tempQuestion.newTopicId);

    if (!isTopicIncludesInNewSubject) {
      const newTopicQ = await db.query.topics.findFirst({
        where: and(
          eq(topics.name, tempQuestion.newTopicName),
          eq(topics.subject_id, tempQuestion.newSubjectId),
        ),
        columns: {
          id: true,
          name: true,
        },
      });

      if (newTopicQ) {
        // move it the correct topic
        await db
          .update(tempQuestionSubject)
          .set({
            newTopicId: newTopicQ.id,
            newTopicName: newTopicQ.name,
          })
          .where(eq(tempQuestionSubject.id, tempQuestion.id))
          .execute();
        console.log(
          `Updated temp question subject id: ${tempQuestion.id} with new topic id: ${newTopicQ.id}`,
        );
      } else {
        console.log(
          `New topic: ${tempQuestion.newTopicName} is not in the subject: ${tempQuestion.newSubjectName}`,
        );
        // create new topic
        const newTopic = await db
          .insert(topics)
          .values({
            name: tempQuestion.newTopicName,
            subject_id: tempQuestion.newSubjectId,
          })
          .returning();

        console.log(
          `Inserted new topic: ${newTopic[0].name} for subject: ${tempQuestion.newSubjectName}`,
        );

        // update the temp question subject
        topicsSubjectMapping[tempQuestion.newSubjectId].push(newTopic[0].id);

        // move it the created topic
        await db
          .update(tempQuestionSubject)
          .set({
            newTopicId: newTopic[0].id,
          })
          .where(eq(tempQuestionSubject.id, tempQuestion.id))
          .execute();
        console.log(
          `Updated temp question subject id: ${tempQuestion.id} with new topic id: ${newTopic[0].id}`,
        );
      }
    }
  }
};

run()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
