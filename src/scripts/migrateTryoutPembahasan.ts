/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */

import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import { tryout_pembahasan, tryout_questions } from '../database/schema';
import { eq } from 'drizzle-orm';

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);

const db = drizzle(pg, {
    schema: {
        tryout_pembahasan,
        tryout_questions
    },
});


const run = async () => {
    const tryoutPembahasan = await db.select().from(tryout_pembahasan).execute();

    let counter = 0;

    for (const pembahasan of tryoutPembahasan) {
        console.log(`Migrating pembahasan ${counter + 1} of ${tryoutPembahasan.length}`);

        const { content, likeCount, tryoutQuestionId } = pembahasan;

        await db.update(tryout_questions).set({
            explanations: [{
                content: content,
                isMedia: false,
            }],
            explanationLikeCount: likeCount,
        }).where(eq(tryout_questions.id, tryoutQuestionId)).execute();
        counter++;
    }

}

run().then(() => {
    console.log('Migration success');
    pg.end();
    process.exit(0);
}).catch((err) => {
    console.error(err);
    pg.end();
    process.exit(1);
})
