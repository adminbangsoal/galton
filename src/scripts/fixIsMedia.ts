const dotenv = require('dotenv');
import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import { questions } from '../database/schema';
import { eq } from 'drizzle-orm';

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);
const db = drizzle(pg, {
    schema: {
        questions,

    },
});

const run = async () => {
    const q = await db.select().from(questions)


    for (let i = 0; i < q.length; i++) {
        const question = q[i];
        const content = question.question;
        const answer = question.answers;

        const regex = /^(https?:\/\/)?([a-zA-Z0-9_-]+\.)+[a-zA-Z]{2,}(\/[a-zA-Z0-9_-]+)*\/?$/;

        for (let i = 0; i < content.length; i++) {
            const c = content[i];

            regex.test(c.content) ? content[i].isMedia = true : content[i].isMedia = false;
        }

        for (let i = 0; i < answer.length; i++) {
            const a = answer[i];

            regex.test(a.content) ? answer[i].isMedia = true : answer[i].isMedia = false;
        }

        // update database
        await db.update(questions).set({ question: content, answers: answer }).where(eq(questions.id, question.id));
        
    }


}

run().then(() => {
    console.log('Done');
    pg.end();
    process.exit(0);
}).catch((error) => {
    console.error(error);
    pg.end();
    process.exit(1);
});