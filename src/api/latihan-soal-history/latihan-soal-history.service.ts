import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { eq, gte, or, lte, and, isNotNull, desc, sql } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DrizzleAsyncProvider } from '../../database/drizzle/drizzle.provider';
import * as schema from '../../database/schema';
import dayjs from 'dayjs';
import { truncateLatexText } from '../../common/lib/utils';
import LatihanSoalService from '../latihan-soal/latihan-soal.service';
import { LatihanSoalSummary } from '../latihan-soal/latihan-soal.type';
import { MathpixMarkdownModel } from 'mathpix-markdown-it';
import * as Window from 'window';
import { JSDOM } from 'jsdom';

@Injectable()
export class LatihanSoalHistoryService {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
    private readonly latihanSoalService: LatihanSoalService,
  ) {}

  async getLatihanSoalHistory(
    userId: string,
    subjectId: string,
    topicId?: string,
    minYear?: number,
    maxYear?: number,
  ) {
    const now = dayjs();
    const priorDay = now.subtract(1, 'day').toDate();
    const { question_attempts, questions } = schema;

    const maxTimestampQuery = this.db
      .select({
        questionId: question_attempts.question_id,
        timestamp: sql`MAX(${question_attempts.timestamp})`.as('max_timestamp'),
      })
      .from(question_attempts)
      .where(
        and(
          eq(question_attempts.user_id, userId),
          or(
            lte(question_attempts.timestamp, priorDay),
            isNotNull(question_attempts.submitted),
          ),
        ),
      )
      .groupBy(question_attempts.question_id)
      .as('max_timestamp');

    const result = await this.db
      .selectDistinctOn([schema.questions.id], {
        question_attempt_id: question_attempts.id,
        questions: questions.question,
        timestamp: question_attempts.timestamp,
        questions_id: questions.id,
        subject_id: questions.subject_id,
      })
      .from(question_attempts)
      .leftJoin(questions, eq(question_attempts.question_id, questions.id))
      .leftJoin(
        maxTimestampQuery,
        and(
          eq(question_attempts.question_id, maxTimestampQuery.questionId),
          eq(question_attempts.timestamp, maxTimestampQuery.timestamp),
        ),
      )
      .where(
        and(
          eq(question_attempts.user_id, userId),
          eq(questions.subject_id, subjectId),
          topicId && eq(questions.topic_id, topicId),
          minYear && !maxYear && gte(questions.year, minYear),
          maxYear && minYear && lte(questions.year, maxYear),
          maxYear &&
            minYear &&
            and(gte(questions.year, minYear), lte(questions.year, maxYear)),
        ),
      )
      .execute();

    const window = new Window();
    global.window = window;
    global.document = window.document;

    global.DOMParser = new JSDOM().window.DOMParser;

    const options = {
      htmlTags: true,
      width: 800,
    };

    for (let i = 0; i < result.length; i++) {
      const firstContent = result[i].questions.find(({ isMedia }) => !isMedia);

      result[i].questions = [
        {
          content: truncateLatexText(firstContent.content),
          isMedia: false,
        },
      ];

      result[i].questions[0]['html_content'] =
        MathpixMarkdownModel.markdownToHTML(firstContent.content);
    }

    result.sort((a, b) => {
      if (a.timestamp > b.timestamp) return -1;
      if (a.timestamp < b.timestamp) return 1;
      return 0;
    });

    return result;
  }

  async getLatihanHistoryByQuestionId(questionId: string, userId: string) {
    const { question_attempts, questions, options, topics } = schema;

    const question = await this.db
      .select({
        content: questions.question,
        answer: questions.answers,
        topic_id: questions.topic_id,
        subject_id: questions.subject_id,
        year: questions.year,
        source: questions.source,
        options: questions.options,
        topic_name: topics.name,
        id: questions.id,
        type: questions.type,
        filled_answers: questions.filledAnswer, // for fill-in type of questions
      })
      .from(schema.questions)
      .leftJoin(topics, eq(topics.id, questions.topic_id))
      .where(eq(questions.id, questionId));

    const questionAttempt = await this.db
      .select({
        id: question_attempts.id,
        choice_id: question_attempts.choice_id,
        timestamp: question_attempts.timestamp,
        submitted: question_attempts.submitted,
        anwser_history: question_attempts.answer_history,
        filled_answers: question_attempts.filledAnswers,
      })
      .from(question_attempts)
      .where(
        and(
          eq(question_attempts.question_id, questionId),
          eq(question_attempts.user_id, userId),
        ),
      )
      .execute();

    if (!questionAttempt.length) {
      throw new BadRequestException('Question attempt not found');
    }

    const user = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));

    // if user is not premium dont return the answer
    if (user[0].validity_date < new Date()) {
      delete question[0].answer;
    }

    return {
      attempts: questionAttempt,
      question: question[0],
    };
  }

  async getTimedLatihanSoalHistoryList(userId: string) {
    const timedQuestionsQuery = await this.db.query.timed_questions.findMany({
      where: eq(schema.timed_questions.userId, userId),
      orderBy: desc(schema.timed_questions.createdAt),
    });

    const res: LatihanSoalSummary[] = [];
    // validate if its already finished
    for (const timedQuestion of timedQuestionsQuery) {
      try {
        if (timedQuestion.submitted) {
          const summary = await this.latihanSoalService.getTimedQuestionSummary(
            userId,
            timedQuestion.id,
          );
          res.push(summary);
        } else {
          if (timedQuestion.mode === 'classic') {
            if (dayjs().diff(timedQuestion.createdAt, 'second') >= 11700) {
              const summary =
                await this.latihanSoalService.getTimedQuestionSummary(
                  userId,
                  timedQuestion.id,
                );
              res.push(summary);
            }
          } else if (timedQuestion.mode === 'sequential') {
            const subject =
              await this.db.query.timed_questions_time_mapping.findFirst({
                where: eq(
                  schema.timed_questions_time_mapping.subjectId,
                  timedQuestion.subjectId,
                ),
              });
            if (
              dayjs().diff(timedQuestion.createdAt, 'second') >=
              subject.timeLimit
            ) {
              const summary =
                await this.latihanSoalService.getTimedQuestionSummary(
                  userId,
                  timedQuestion.id,
                );
              res.push(summary);
            }
          }
        }
      } catch (e) {
        continue;
      }
    }

    return res;
  }

  // Mobile API
  async getMobileLatihanSoalHistory(
    userId: string,
    subjectId: string,
    topicId?: string,
    minYear?: number,
    maxYear?: number,
    limit?: number,
  ) {
    const now = dayjs();
    const priorDay = now.subtract(1, 'day').toDate();
    const { question_attempts, questions } = schema;

    const maxTimestampQuery = this.db
      .select({
        questionId: question_attempts.question_id,
        timestamp: sql`MAX(${question_attempts.timestamp})`.as('max_timestamp'),
      })
      .from(question_attempts)
      .where(
        and(
          eq(question_attempts.user_id, userId),
          or(
            lte(question_attempts.timestamp, priorDay),
            isNotNull(question_attempts.submitted),
          ),
        ),
      )
      .groupBy(question_attempts.question_id)
      .as('max_timestamp');

    const result = await this.db
      .selectDistinctOn([schema.questions.id], {
        question_attempt_id: question_attempts.id,
        questions: questions.question,
        timestamp: question_attempts.timestamp,
        questions_id: questions.id,
        subject_id: questions.subject_id,
      })
      .from(question_attempts)
      .leftJoin(questions, eq(question_attempts.question_id, questions.id))
      .leftJoin(
        maxTimestampQuery,
        and(
          eq(question_attempts.question_id, maxTimestampQuery.questionId),
          eq(question_attempts.timestamp, maxTimestampQuery.timestamp),
        ),
      )
      .where(
        and(
          eq(question_attempts.user_id, userId),
          eq(questions.subject_id, subjectId),
          topicId && eq(questions.topic_id, topicId),
          minYear && !maxYear && gte(questions.year, minYear),
          maxYear && minYear && lte(questions.year, maxYear),
          maxYear &&
            minYear &&
            and(gte(questions.year, minYear), lte(questions.year, maxYear)),
        ),
      )
      .limit(limit || undefined)
      .execute();

    const window = new Window();
    global.window = window;
    global.document = window.document;

    global.DOMParser = new JSDOM().window.DOMParser;

    const options = {
      htmlTags: true,
    };

    for (let i = 0; i < result.length; i++) {
      const firstContent = result[i].questions.find(({ isMedia }) => !isMedia);
      result[i].questions = [
        {
          content: MathpixMarkdownModel.markdownToHTML(
            truncateLatexText(firstContent.content),
            options,
          ),
          isMedia: false,
        },
      ];
    }

    result.sort((a, b) => {
      if (a.timestamp > b.timestamp) return -1;
      if (a.timestamp < b.timestamp) return 1;
      return 0;
    });
    return result;
  }
}
