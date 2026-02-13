const dotenv = require('dotenv');
import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import { questions as q, subjects as s, topics as t } from '../database/schema';
import { eq, inArray, not } from 'drizzle-orm';
import axios from 'axios';

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);
const db = drizzle(pg, {
  schema: {
    q,
    s,
    t,
  },
});

const AI_URL = 'https://ai.bangsoal.co';

const run = async () => {
  console.log(`Fixing subtype result not found...`);

  const topics = await db
    .select()
    .from(t)
    .where(eq(t.name, 'Subtype result not found'));

  const questions = await db
    .select()
    .from(q)
    .where(
      inArray(
        q.topic_id,
        topics.map((t) => t.id),
      ),
    );

  const subjects = await db
    .select({
      id: s.id,
      name: s.name,
    })
    .from(s)
    .where(not(eq(s.name, 'UNDECIDED')));

  for (let i = 0; i < questions.length; i++) {
    console.log(`Processing question ${i + 1} of ${questions.length}`);
    const question = questions[i];
    const content = question.question.filter((q) => q.isMedia == false);
    const subjectName = subjects.find((s) => s.id == question.subject_id).name;
    // merge the content
    const mergedContent = content.map((c) => c.content).join(' ');

    const { data } = await axios.post<{ data: string }>(
      `${AI_URL}/predict-type-task`,
      {
        question: mergedContent,
        main_type: subjectName,
      },
      {
        headers: {
          'access-key': process.env.BANGSOAL_AI_API_KEY,
        },
      },
    );

    console.log(`Question ${question.id} predicted as ${data.data}`);

    const newTopic = await db.select().from(t).where(eq(t.name, data.data));

    console.log(
      `Updating question ${question.id} topic to ${newTopic[0].name}`,
    );

    await db
      .update(q)
      .set({
        topic_id: newTopic[0].id,
        subject_id: newTopic[0].subject_id,
      })
      .where(eq(q.id, question.id));

    console.log(`Question ${question.id} updated`);
  }

  console.log(`Deleting topic Subtype result not found...`);

  await db.delete(t).where(eq(t.name, 'Subtype result not found'));

  console.log(`Done fixing subtype result not found...`);
};

run()
  .then(() => {
    console.log('done');
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
