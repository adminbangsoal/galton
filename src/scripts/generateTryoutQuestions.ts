/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-var-requires */
import { sql, eq, and, gte, inArray } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { S3Service } from '../s3/s3.service';
import { Question, questions, subjects, topics } from '../database/schema';
import axios, { AxiosError } from 'axios';
import postgres from 'postgres';
import { PgSelect } from 'drizzle-orm/pg-core';
import { ConfigService } from '@nestjs/config';
const dotenv = require('dotenv');

dotenv.config();

type QuestionType =
  | 'fill-in'
  | 'table-choice'
  | 'multiple-choice'
  | 'multiple-answer';

interface SubjectConfig {
  name: string;
  total?: number;
  'multiple-choice'?: number;
  'fill-in'?: number;
  'table-choice'?: number;
  'multiple-answer'?: number;
}

interface ApiResponse {
  type: QuestionType;
  question: string;
  answer: string;
  options?: string[];
  question_id: string;
  source: string;
}

const pg = postgres(process.env.DATABASE_URL!);
const db = drizzle(pg, { schema: { questions, subjects, topics } });
const API_URL = 'https://ai.bangsoal.co';
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY = 5000;

const ENDPOINTS: Record<QuestionType, string> = {
  'fill-in': '/create-question-isian',
  'table-choice': '/create-question-tf',
  'multiple-answer': '/create-question-mult',
  'multiple-choice': '/create-question',
};

const SUBJECT_CONFIGS: SubjectConfig[] = [
  // add more subjects here
  {
    name: 'Penalaran Induktif',
    'multiple-choice': 7,
    'multiple-answer': 3,
  },
  {
    name: 'Penalaran Deduktif',
    'multiple-choice': 7,
    'multiple-answer': 3,
  },
  {
    name: 'Penalaran Kuantitatif',
    'multiple-choice': 7,
    'multiple-answer': 3,
  },
  {
    name: 'Pengetahuan dan Pemahaman Umum',
    'multiple-choice': 20,
    'multiple-answer': 0,
  },
  {
    name: 'Kemampuan Memahami Bacaan dan Menulis',
    'multiple-choice': 20,
    'multiple-answer': 0,
  },
  {
    name: 'Pengetahuan Kuantitatif',
    'multiple-choice': 7,
    'multiple-answer': 2,
    'fill-in': 3,
    'table-choice': 3,
  },
  {
    name: 'Literasi dalam Bahasa Indonesia',
    'multiple-choice': 20,
    'multiple-answer': 0,
  },
  {
    name: 'Literasi dalam Bahasa Inggris',
    'multiple-choice': 20,
    'multiple-answer': 0,
  },
  {
    name: 'Penalaran Matematika',
    'multiple-choice': 8,
    'multiple-answer': 5,
    'fill-in': 4,
    'table-choice': 3,
  },
];

const penalaranKuantitatifTopicMapping = [
  'Aritmatika Sosial',
  'Aturan Pencacahan',
  'Barisan dan Deret',
  'Operasi Bilangan',
];

const makeApiCall = async (
  endpoint: string,
  data: any,
  retries = MAX_RETRIES,
): Promise<any> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.post(`${API_URL}${endpoint}`, data, {
        headers: { 'access-key': process.env.BANGSOAL_AI_API_KEY },
      });
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(
        `\nAPI call to ${endpoint} failed (Attempt ${
          i + 1
        }/${retries}): ${JSON.stringify(axiosError.response.data)}`,
      );

      if (i === retries - 1) throw error;

      const delayMs = INITIAL_RETRY_DELAY * Math.pow(2, i);
      console.log(`Retrying in ${delayMs / 1000} seconds...`);
      await delay(delayMs);
    }
  }
};

const generateQuestion = async (
  type: QuestionType,
  questionData: any,
): Promise<ApiResponse> => {
  console.log(`Generating with question id: `, questionData.id);

  const data: Record<string, unknown> = {
    'table-choice': {
      question: questionData.content.content,
      total_question: '3',
    },
    'fill-in': {
      question: questionData.content.content,
      explanation: questionData.answer.content,
      answer: questionData.answers[0].content,
    },
    'multiple-answer': { question: questionData.content.content },
    'multiple-choice': {
      question: questionData.content.content,
      choice: JSON.stringify(questionData.options),
      raw_answer: questionData.answer.content,
    },
  }[type];

  try {
    const result = await makeApiCall(ENDPOINTS[type], data);
    if (
      (type === 'multiple-answer' || type === 'multiple-choice') &&
      result.data
    ) {
      result.data = {
        question: result.data.Question,
        answer: result.data.Answer,
        choice: result.data.Choice || result.data.choice,
      };
    }
    return {
      type,
      ...result,
      question_id: questionData.id,
      source: questionData.source,
    };
  } catch (error) {
    console.error(
      `Error generating ${type} question:`,
      (error as Error).message,
    );
    console.log(`Using fallback question for ${type}`);
    return {
      type,
      question: questionData.content.content,
      answer: questionData.answer.content,
      options: questionData.options,
      question_id: questionData.id,
      source: questionData.source,
    };
  }
};

const generateQuestionsForSubject = async (
  subjectConfig: SubjectConfig,
): Promise<ApiResponse[]> => {
  console.log(`Generating questions for ${subjectConfig.name}`);

  // if its penalaran kuantitatif, we need to filter the questions from the KPU topics spesific on Penalaran Kuantitatif Topic

  let randomQuestions: Question[] = [];

  if (
    subjectConfig.name === 'Penalaran Kuantitatif' ||
    subjectConfig.name === 'Penalaran Induktif' ||
    subjectConfig.name === 'Penalaran Deduktif'
  ) {
    const subject = await db.query.subjects.findFirst({
      where: eq(subjects.name, 'Kemampuan Penalaran Umum'),
    });

    const topicFilter =
      subjectConfig.name === 'Penalaran Kuantitatif'
        ? penalaranKuantitatifTopicMapping
        : [subjectConfig.name];

    const topic = await db.query.topics.findMany({
      where: and(
        eq(topics.subject_id, subject.id),
        inArray(topics.name, topicFilter),
      ),
    });

    randomQuestions = await db
      .select()
      .from(questions)
      .where(
        and(
          gte(questions.year, 2021),
          eq(questions.subject_id, subject.id),
          inArray(
            questions.topic_id,
            topic.map((t) => t.id),
          ),
        ),
      )
      .orderBy(sql`RANDOM()`);

    console.log(
      `Total questions for ${subjectConfig.name}: ${randomQuestions.length}`,
    );
    console.log(
      `Data for ${subjectConfig.name}: ${JSON.stringify(randomQuestions)}`,
    );
  } else {
    const subject = await db
      .select()
      .from(subjects)
      .where(eq(subjects.name, subjectConfig.name))
      .limit(1)
      .then((res) => res[0]);

    randomQuestions = await db
      .select()
      .from(questions)
      .where(
        and(eq(questions.subject_id, subject.id), gte(questions.year, 2021)),
      )
      .orderBy(sql`RANDOM()`);
  }

  const questionTypes: QuestionType[] = [];
  (Object.keys(ENDPOINTS) as QuestionType[]).forEach((type) => {
    const count = subjectConfig[type] || 0;
    questionTypes.push(...Array(count).fill(type));
  });

  let counter = 0;
  const res: ApiResponse[] = [];

  for (let i = 0; i < questionTypes.length; i++) {
    // reset counter if it exceed the randomQuestions length
    if (counter >= randomQuestions.length) {
      counter = 0;
    }
    const question = randomQuestions[counter];
    const result = await generateQuestion(questionTypes[i], question);
    res.push(result);
    counter++;
  }

  return res;
};

const run = async () => {
  console.log('Running Question Generator Script...');

  const allResponses: Record<string, ApiResponse[]> = {};

  for (const config of SUBJECT_CONFIGS) {
    console.log(`Starting generation for ${config.name}`);
    const subjectResponses = await generateQuestionsForSubject(config);
    allResponses[config.name] = subjectResponses;
    console.log(
      `Finished generation for ${config.name}. Total questions: ${subjectResponses.length}\n`,
    );
  }

  const args = process.argv.slice(2);
  let identifier = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--identifier=')) {
      identifier = args[i].split('=')[1];
    }
  }

  if (!identifier) {
    console.error('Please provide an --identifier argument.');
    process.exit(1);
  }

  const configService = new ConfigService();
  const s3Service = new S3Service(configService);
  const outputPath = `tryout-questions/${identifier}.json`;

  await s3Service.uploadFile(
    Buffer.from(JSON.stringify(allResponses, null, 2)),
    outputPath,
    'bangsoal',
  );

  console.log(`Responses uploaded to S3 at ${outputPath}`);
};

run()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((err) => {
    console.error('An error occurred during execution:', err);
    process.exit(1);
  });

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
