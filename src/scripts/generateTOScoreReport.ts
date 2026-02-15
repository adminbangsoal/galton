/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import {
  tryout_attempts,
  users,
  tryouts,
  tryout_set_attempts,
  tryout_subjects,
  tryout_sets,
} from '../database/schema';
import { eq, desc, and } from 'drizzle-orm';
import { stringify } from 'csv-stringify';
import * as fs from 'fs';
const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);

const db = drizzle(pg, {
  schema: {
    tryout_attempts,
    users,
    tryouts,
    tryout_set_attempts,
  },
});

const run = async () => {
  const result: any = await db
    .select({
      user: users.full_name,
      phone_number: users.phone_number,
      total_score: tryout_attempts.score,
      user_id: users.id,
      tryout_id: tryout_attempts.tryoutId,
    })
    .from(tryout_attempts)
    .where(eq(tryout_attempts.tryoutId, '073b1d0d-47e4-48f2-ba5d-f60d8d6f614b'))
    .leftJoin(users, eq(tryout_attempts.userId, users.id))
    .leftJoin(tryouts, eq(tryout_attempts.tryoutId, tryouts.id))
    .orderBy(desc(tryout_attempts.score))
    .execute();

  for (let i = 0; i < result.length; i++) {
    // get the set attempt

    const setAttempts = await db
      .select({
        name: tryout_subjects.name,
        score: tryout_set_attempts.score,
      })
      .from(tryout_set_attempts)
      .innerJoin(
        tryout_sets,
        eq(tryout_sets.id, tryout_set_attempts.tryoutSetId),
      )
      .leftJoin(tryout_subjects, eq(tryout_sets.subjectId, tryout_subjects.id))
      .where(
        and(
          eq(tryout_set_attempts.tryoutId, result[i].tryout_id),
          eq(tryout_set_attempts.userId, result[i].user_id),
        ),
      )
      .execute();

    result[i].pu =
      setAttempts
        .find((setAttempt) => setAttempt.name === 'Kemampuan Penalaran Umum')
        ?.score?.toFixed(2) || 0;
    result[i].ppu =
      setAttempts
        .find(
          (setAttempt) => setAttempt.name === 'Pengetahuan dan Pemahaman Umum',
        )
        ?.score.toFixed(2) || 0;
    result[i].pk =
      setAttempts
        .find((setAttempt) => setAttempt.name === 'Pengetahuan Kuantitatif')
        ?.score.toFixed(2) || 0;
    result[i].lbi =
      setAttempts
        .find((setAttempt) => setAttempt.name === 'Bahasa Indonesia')
        ?.score.toFixed(2) || 0;
    result[i].lbe =
      setAttempts
        .find((setAttempt) => setAttempt.name === 'Bahasa Inggris')
        ?.score.toFixed(2) || 0;
    result[i].pbm =
      setAttempts
        .find(
          (setAttempt) => setAttempt.name === 'Pemahaman Bacaan dan Menulis',
        )
        ?.score.toFixed(2) || 0;
    result[i].pm =
      setAttempts
        .find((setAttempt) => setAttempt.name === 'Penalaran Matematika')
        ?.score.toFixed(2) || 0;

    delete result[i].tryout_id;
    delete result[i].user_id;
  }

  console.log(result[0]);

  const columns = {
    user: 'User',
    phone_number: 'Phone Number',
    total_score: 'Total Score',
    pu: 'PU Score',
    ppu: 'PPU Score',
    pbm: 'PBM Score',
    pk: 'PK Score',
    lbi: 'LBI Score',
    lbe: 'LBE Score',
    pm: 'PM Score',
  };

  // Create a writable stream for your CSV file
  const writableStream = fs.createWriteStream('rekapTOKMD2.csv');

  // Create the stringifier with specified columns and options
  const stringifier = stringify({ header: true, columns: columns });

  // Listen for errors on the stringifier stream
  stringifier.on('error', (err) => {
    console.error('Stringify error:', err);
  });

  // Pipe the stringifier output to the file writable stream
  stringifier.pipe(writableStream);

  // Write each result object to the stringifier
  result.forEach((row) => {
    // Directly write the object assuming keys match column configuration
    stringifier.write(row);
  });

  // End the stringifier to indicate no more data will be written
  stringifier.end();

  // Wait for the 'finish' event on the writableStream before proceeding
  await new Promise((resolve, reject) => {
    writableStream.on('finish', resolve);
    writableStream.on('error', reject);
  });

  console.log('Finished writing data to CSV.');
};

run()
  .then(() => {
    console.log('done');
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
