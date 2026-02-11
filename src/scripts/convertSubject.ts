/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */

import { drizzle } from 'drizzle-orm/postgres-js';
import * as postgres from 'postgres';
import { subjects, questions } from '../database/schema';
import axios from 'axios';
import { sql } from 'drizzle-orm'

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);
const db = drizzle(pg, {
    schema: {
        subjects,
        questions
    },
});


const run = async () => {
    console.log('Running...');
    const sub = await db.select().from(subjects)

    // get the questions and exclute that already in the temporary table
    const q = await db.execute(sql`select id, content, topic_id from questions where topic_id = '7ab9324d-6398-4937-8892-e6b3765a51ea' and id not in (select question_id from temporary_topic)`);

    let counter = 0

    for (let i = 0; i < 2; i++) {
        const question = q[i];
        counter += 1;

        q[i].content = JSON.parse((question as any).content);

        const content: any = (q[i].content as any)
        // skip if have image
        if (content.asset_url) continue;

        try {
            console.log('predicting type for question ', counter, '/', q.length, '...');
            // predict the new type
            const { data } = await axios.post('https://ai.bangsoal.co/predict-type-task/', {
                question: content.content,
                main_type: "undecided",
            }, {
                headers: {
                    'access-key': process.env.BANGSOAL_AI_API_KEY
                }
            })

            console.log('inserting temporary topic...')
            // get the new topic
            console.log('finding new topic from ', data.data.type, ' ...');

            const subjectId = sub.find(({ name }) => name === data.data.type)?.id;

            const newTopic = await db.execute(sql`select id from topics where name = ${data.data.subtype} and subject_id = ${subjectId}`);

            // new topic
            const newTopicId = newTopic[0].id;

            console.log('change topic from ', question.topic_id, ' to ', newTopicId);

            console.log('question content: ', content.content);

            await db.execute(sql`insert into temporary_topic (question_id, topic_id, new_topic_id, metadata) values (
                ${question.id},
                ${question.topic_id},
                ${newTopicId},
                ${JSON.stringify(data.data)}
                )`);

        } catch (err) {
            console.error(err);
        }
    }



    console.log('Done');
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