/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */

import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import { tryout_subjects, tryout_pembahasan, tryout_questions } from '../database/schema';
import { TryoutQuestion } from './seedTryoutQuestions';
import { eq } from 'drizzle-orm';


const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);
const db = drizzle(pg, {
    schema: {
        tryout_subjects,
        tryout_pembahasan,
        tryout_questions
    },
});

const run = async () => {


    const data = await db.select().from(tryout_questions).execute();

    const rawData = await import('./data/to_raw.json');
    for (let i = 0; i < rawData.TryoutQuestions.length; i++) {
        const question = rawData.TryoutQuestions[i];
        const questionData = data.find((d) => d.content === question.content);
        if (questionData) {
            const value = {
                content: question.answer,
                contentImage: question.answer_image,
                tryoutQuestionId: questionData.id,
            }
            
            const pembahasan = await db.select().from(tryout_pembahasan).where(eq(tryout_pembahasan.tryoutQuestionId, questionData.id)).execute();
    
            if (pembahasan.length === 0) {
                await db.insert(tryout_pembahasan).values(value).execute();
            } else {
                await db.update(tryout_pembahasan).set(value).where(eq(tryout_pembahasan.tryoutQuestionId, questionData.id)).execute();
            }
        }
    }
}

run().then(() => {
    console.log('Done executing script!');
    process.exit(0);
}).catch((err) => {
    console.error(err);
    process.exit(1);
})