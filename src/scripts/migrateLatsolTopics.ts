import { drizzle } from "drizzle-orm/postgres-js";
import * as postgres from "postgres";
import { questions, tempQuestionSubject, subjects, topics } from "../../src/database/schema";
import { and, eq } from "drizzle-orm";

const dotenv = require('dotenv');

dotenv.config();

const pg = postgres(process.env.DATABASE_URL);

const db = drizzle(pg, {
    schema: {
        tempQuestionSubject,
        questions,
        subjects,
        topics
    },
});

const run = async () => {
    console.log('Running Migrate Latihan Soal Topics Scripts...')

    const tempQuestions = await db.query.tempQuestionSubject.findMany({
        columns: {
            newTopicId: true,
            newSubjectId: true,
            questionId: true,
            newSubjectName: true,
            newTopicName: true
        }
    });
    const questionsQuery = await db.query.questions.findMany({
        columns: {
            id: true,
            topic_id: true,
            subject_id: true,
            content: true,
        }
    });

    const undecidedSubject = await db.query.subjects.findFirst({
        where: eq(subjects.name, 'UNDECIDED')
    })

    const undecidedTopic = await db.query.topics.findFirst({
        where: and(eq(topics.name, 'UNDECIDED'), eq(topics.subject_id, undecidedSubject.id))
    })

    // update the question subject id and topic id
    console.log('Migrating questions to new topics and subjects...');
    for (let i = 0; i < tempQuestions.length; i++) {
        const tQuestion = tempQuestions[i];

        if (tQuestion.newTopicName === 'Subtype result not found') {
            console.log(`Question ${tQuestion.questionId} has no subtype result, moving to UNDECIDED subject`);
            await db.update(questions).set({
                topic_id: undecidedTopic.id,
                subject_id: undecidedSubject.id
            }).where(eq(questions.id, tQuestion.questionId)).execute();


        } else {
            const question = questionsQuery.find((q) => q.id === tempQuestions[i].questionId);
            console.log(`Moving question ${question.id} to new subject: ${tempQuestions[i].newSubjectName} and topic: ${tempQuestions[i].newTopicName}`);
            // update the question subject id and topic id
            await db.update(questions).set({
                topic_id: tempQuestions[i].newTopicId,
                subject_id: tempQuestions[i].newSubjectId
            }).where(eq(questions.id, question.id)).execute();
        }
    }

    const questionHaveImages = [];
    for (let i = 0; i < questionsQuery.length; i++) {
        if (questionsQuery[i].content.asset_url) {
            questionHaveImages.push(questionsQuery[i].id);
        }
    }

    console.log('Move questions with image to UNDECIDED subject');

    for (let i = 0; i < questionHaveImages.length; i++) {
        console.log(`Moving question ${questionHaveImages[i]} that have asset to UNDECIDED subject`);
        await db.update(questions).set({
            topic_id: undecidedTopic.id,
            subject_id: undecidedSubject.id
        }).where(eq(questions.id, questionHaveImages[i])).execute();
    }

    console.log('Done');
}

run().then(() => {
    console.log('Done');
    process.exit(0)
}).catch((err) => {
    console.error(err);
    process.exit(1);
})