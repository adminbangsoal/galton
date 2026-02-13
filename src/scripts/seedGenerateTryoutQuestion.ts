/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */
import { eq } from 'drizzle-orm';
import { S3Service } from '../s3/s3.service';
import { drizzle } from 'drizzle-orm/postgres-js';
import { v4 as uuidv4 } from 'uuid';
import {
  tryouts,
  tryout_sets,
  tryout_questions,
  tryout_subjects,
} from '../database/schema/tryouts.schema';
import * as postgres from 'postgres';
import { ConfigService } from '@nestjs/config';
const dotenv = require('dotenv');

dotenv.config();

const run = async () => {
  console.log('Running Tryout Seeder Script...');

  type QuestionType =
    | 'multiple-choice'
    | 'fill-in'
    | 'table-choice'
    | 'multiple-answer';

  interface GeneratedQuestion {
    type: QuestionType;
    source: string;
    question_id: string;
    data: {
      question: string;
      choice?: {
        content?: string;
        statement?: string;
        is_true: boolean;
        key?: string;
      }[];
      answer?: string;
      explanation?: string;
    };
  }

  interface GeneratedQuestions {
    [subject: string]: GeneratedQuestion[];
  }

  const client = postgres(process.env.DATABASE_URL!);
  const db = drizzle(client, {
    schema: {
      tryouts,
      tryout_sets,
      tryout_questions,
      tryout_subjects,
    },
  });
  const args = process.argv.slice(2);
  let tryoutName = '';
  let tryoutDescription = '';
  let identifier = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--tryoutName=')) {
      tryoutName = args[i].split('=')[1];
    } else if (args[i].startsWith('--tryoutDescription=')) {
      tryoutDescription = args[i].split('=')[1];
    } else if (args[i].startsWith('--identifier=')) {
      identifier = args[i].split('=')[1];
    }
  }

  if (!tryoutName || !tryoutDescription || !identifier) {
    console.error(
      'Please provide --tryoutName, --tryoutDescription, and --identifier arguments.',
    );
    process.exit(1);
  }

  const seedTryoutFromGeneratedQuestions = async () => {
    const configService = new ConfigService();
    const s3Service = new S3Service(configService); // Initialize S3Service
    const generatedQuestionsPath = `tryout-questions/${identifier}.json`;

    const presignedUrl = await s3Service.getPresignedUrl(
      generatedQuestionsPath,
      'bangsoal',
    );

    const response = await fetch(presignedUrl);
    const generatedQuestionsData = await response.text();
    const generatedQuestions: GeneratedQuestions = JSON.parse(
      generatedQuestionsData,
    );

    // create tryout
    const [tryout] = await db
      .insert(tryouts)
      .values({
        name: tryoutName,
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        description: tryoutDescription,
        isWindow: true,
        timeLimit: 60 * 60 * 1000,
      })
      .returning();

    let previousSetId: string | null = null;

    for (const [subjectName, questions] of Object.entries(generatedQuestions)) {
      // fetch existing subject
      const [subject] = await db
        .select()
        .from(tryout_subjects)
        .where(eq(tryout_subjects.name, subjectName));

      if (!subject) {
        console.warn(`Subject "${subjectName}" not found. Skipping...`);
        continue;
      }

      // create tryout set
      const [tryoutSet] = await db
        .insert(tryout_sets)
        .values({
          tryoutId: tryout.id,
          subjectId: subject.id,
          duration: 3600,
        })
        .returning();

      // update the previous set's nextSet if it exists
      if (previousSetId) {
        await db
          .update(tryout_sets)
          .set({ nextSet: tryoutSet.id })
          .where(eq(tryout_sets.id, previousSetId));
      } else {
        // if this is the first set, update the tryout's firstSetId
        await db
          .update(tryouts)
          .set({ firstSetId: tryoutSet.id })
          .where(eq(tryouts.id, tryout.id));
      }

      previousSetId = tryoutSet.id;

      // create tryout questions
      const tryoutQuestionValues = questions
        .map((q: GeneratedQuestion) => {
          return {
            tryoutSetId: tryoutSet.id,
            content: q.data.question,
            options:
              q.type === 'multiple-answer' ||
              q.type === 'table-choice' ||
              q.type === 'multiple-choice'
                ? q.data.choice?.map((c) => ({
                    id: uuidv4(),
                    key: c.key,
                    content: c.content,
                    statement: c.statement,
                    is_true: c.is_true,
                  })) || []
                : [],
            isTextAnswer: q.type === 'fill-in',
            source: q.source,
            questionId: q.question_id,
            type: q.type as QuestionType,
            answers: q.data.answer ? [q.data.answer] : undefined,
            explanations: q.data.explanation
              ? [{ content: q.data.explanation, isMedia: false }]
              : [],
          };
        })
        .filter((q) => q !== null);

      await db.insert(tryout_questions).values(tryoutQuestionValues);
    }

    console.log('Tryout seeded successfully');
  };

  try {
    await seedTryoutFromGeneratedQuestions();
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    await client.end();
  }
};

run()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((err) => {
    console.error('An error occurred during script execution:', err);
    process.exit(1);
  });
