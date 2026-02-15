import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { subjects, topics } from '../database/schema';
import { eq } from 'drizzle-orm';
import * as subjectMapping from './data/subject_mapping_v2.json';

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);
const db = drizzle(pg, {
  schema: {
    subjects,
    topics,
  },
});

const run = async () => {
  console.log('Running Predict Questions Topic Script...');

  const subjectDatabaseMapping = {};

  // Get All Subjects and Topics
  const subjectsQuery = await db.select().from(subjects).execute();

  console.log('Success querying subjects');

  for (const subject of subjectsQuery) {
    const t = await db
      .select()
      .from(topics)
      .where(eq(topics.subject_id, subject.id))
      .execute();
    const topicSubject = [];

    for (const topic of t) {
      topicSubject.push(topic.name);
    }

    subjectDatabaseMapping[subject.name] = topicSubject;
  }

  // For each subjects, check it in the mapping data, if the topics is not available yet in the DB, insert the new topic into DB
  for (const subject of subjectMapping) {
    const needToBeDelete = subtractSets(
      new Set(subjectDatabaseMapping[subject.name]),
      new Set(subject.topics),
    );

    console.log(
      `Need to be delete for ${subject.name}: ${Array.from(needToBeDelete)}`,
    );

    // delete the topics that are not in the new subject
    for (const topic of needToBeDelete) {
      const s = subjectsQuery.find((s) => s.name === subject.name);
      const t = await db
        .delete(topics)
        .where(eq(topics.name, topic))
        .returning()
        .execute();
      console.log(`Deleted topic: ${t[0].name} for subject: ${s.name}`);
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

function subtractSets(setA, setB) {
  return new Set([...setA].filter((elem) => !setB.has(elem)));
}
