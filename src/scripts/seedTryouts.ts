import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import {
  tryout_subjects,
  tryout_attempts,
  tryout_sets,
  tryout_set_attempts,
  tryouts,
  tryout_questions,
} from '../database/schema';
import * as dayjs from 'dayjs';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { faker } from '@faker-js/faker';

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);
const db = drizzle(pg, {
  schema: {
    tryout_subjects,
    tryout_sets,
    tryout_attempts,
    tryout_set_attempts,
    tryouts,
  },
});

const run = async () => {
  const tryoutSetIds = [];
  // get all subject id
  const subjects = await db.select().from(tryout_subjects);

  // create tryout
  const tryout = await db
    .insert(tryouts)
    .values({
      description: 'tryout test',
      expiryDate: dayjs().add(1, 'year').toDate(),
      name: faker.lorem.words(2),
      timeLimit: 3600,
    })
    .returning();

  // seed tryout set
  for (let i = 0; i < subjects.length; i++) {
    const tryoutSet = await db
      .insert(tryout_sets)
      .values({
        duration: 120,
        subjectId: subjects[i].id,
        tryoutId: tryout[0].id,
      })
      .returning();

    if (i == 0) {
      await db
        .update(tryouts)
        .set({
          firstSetId: tryoutSet[0].id,
        })
        .where(eq(tryouts.id, tryout[0].id));
    }

    tryoutSetIds.push(tryoutSet[0].id);
  }

  // set next set per to set
  for (let i = 0; i < tryoutSetIds.length; i++) {
    if (i == tryoutSetIds.length - 1) break;

    await db
      .update(tryout_sets)
      .set({
        nextSet: tryoutSetIds[i + 1],
      })
      .where(eq(tryout_sets.id, tryoutSetIds[i]));
  }

  // generate questions
  for (let i = 0; i < tryoutSetIds.length; i++) {
    const questions = [];
    const toSet = await db
      .select()
      .from(tryout_sets)
      .where(eq(tryout_sets.id, tryoutSetIds[i]));
    const setSubject = await db
      .select()
      .from(tryout_subjects)
      .where(eq(tryout_subjects.id, toSet[0].subjectId));
    // get subject question limit

    for (let j = 0; j < setSubject[0].questionsLimit; j++) {
      const options = [];

      for (const items of ['A', 'B', 'C', 'D', 'E']) {
        options.push({
          id: faker.string.uuid(),
          content: faker.lorem.words(2),
          key: items,
          isTrue: items == 'A',
        });
      }

      questions.push({
        id: faker.string.uuid(),
        tryoutSetId: tryoutSetIds[i],
        content: faker.lorem.words(10),
        contentImage: faker.image.imageUrl(),
        options: options,
        isTextAnswer: false,
        source: faker.lorem.words(2),
        questionId: 'f7086f95-0911-49e9-a723-21b323f99073',
      });
    }

    await db.insert(tryout_questions).values(questions).returning();
  }
};

run()
  .then(() => {
    console.log('seeded');
    pg.end();
  })
  .catch((e) => {
    console.log(e);
    pg.end();
  });
