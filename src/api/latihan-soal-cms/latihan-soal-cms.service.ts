import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ne, eq, and, inArray, asc } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DrizzleAsyncProvider } from '../../database/drizzle/drizzle.provider';
import * as schema from '../../database/schema';
import { UpdateLatihanSoalDTO } from '../latihan-soal/latihan-soal.dto';

@Injectable()
export default class LatihanSoalCmsService {
  private readonly logger = new Logger(LatihanSoalCmsService.name);
  constructor(
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
  ) {}

  async getQuestions(page: number, limit: number) {
    const offset: number = (page - 1) * limit;
    const questions = await this.db
      .select({
        id: schema.questions.id,
        type: schema.questions.type,
        content: schema.questions.question,
        answer: schema.questions.filledAnswer,
        raw_answer: schema.questions.answers,
        topic_id: schema.questions.topic_id,
        year: schema.questions.year,
        source: schema.questions.source,
        choices: schema.questions.options,
      })
      .from(schema.questions)
      .limit(limit)
      .orderBy(asc(schema.questions.id))
      .offset(offset)
      .execute();
    return questions;
  }

  async getAllQuestionsWithFeedback() {
    const questions = await this.db
      .select()
      .from(schema.question_feedbacks)
      .where(
        and(
          ne(schema.question_feedbacks.feedback, ''),
          eq(schema.question_feedbacks.is_like, false),
        ),
      )
      .execute();

    return questions;
  }

  async getQuestionFeedbackByQuestionId(questionId: string) {
    const question = await this.db
      .select()
      .from(schema.question_feedbacks)
      .where(eq(schema.question_feedbacks.question_id, questionId))
      .execute();

    return question ?? [];
  }

  async getQuestionFeedbackByTopicId(topicId: string) {
    const questions = await this.db
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.topic_id, topicId))
      .execute();

    const questionIds = questions.map((question) => question.id);

    if (!questionIds.length) {
      return [];
    }

    const feedbacks = await this.db
      .select()
      .from(schema.question_feedbacks)
      .where(
        and(
          ne(schema.question_feedbacks.feedback, ''),
          inArray(schema.question_feedbacks.question_id, questionIds),
        ),
      )
      .execute();

    return feedbacks;
  }

  async getAllFeedbackedTopics() {
    const topicsFeedbacked = await this.db
      .selectDistinct({
        topic_id: schema.questions.topic_id,
        topic_name: schema.topics.name,
      })
      .from(schema.question_feedbacks)
      .leftJoin(
        schema.questions,
        eq(schema.question_feedbacks.question_id, schema.questions.id),
      )
      .leftJoin(schema.topics, eq(schema.questions.topic_id, schema.topics.id))
      .where(
        and(
          ne(schema.question_feedbacks.feedback, ''),
          eq(schema.question_feedbacks.is_like, false),
        ),
      )
      .execute();

    return topicsFeedbacked;
  }

  async unpassQuestionQc(questionId: string) {
    this.logger.log(`Unpassing question with id ${questionId}`);

    const question = await this.db
      .update(schema.questions)
      .set({ published: false, updated_at: new Date() })
      .where(eq(schema.questions.id, questionId))
      .returning({
        id: schema.questions.id,
      })
      .execute();

    this.logger.log(`Question with id ${questionId} has been unpassed`);

    await this.db
      .delete(schema.question_feedbacks)
      .where(
        and(
          eq(schema.question_feedbacks.question_id, questionId),
          eq(schema.question_feedbacks.is_like, false),
        ),
      )
      .execute();

    return question;
  }

  async upsertLatihanSoal(body: UpdateLatihanSoalDTO) {
    const {
      source,
      filled_answer,
      answers,
      year,
      question,
      id,
      topic_id,
      options,
      type,
      published,
    } = body;
    const query = await this.db
      .select({
        topic_id: schema.topics.id,
        subject_id: schema.topics.subject_id,
      })
      .from(schema.topics)
      .where(eq(schema.topics.id, topic_id))
      .execute();
    const topic = query[0];
    const value = {
      published: published,
      source: source,
      year: year,
      updated_at: new Date(),
      id: id,
      question: question as schema.Content[],
      answers: answers as schema.Content[],
      filledAnswer: filled_answer,
      subject_id: topic.subject_id,
      topic_id: topic_id,
      type: type,
    };
    if (options) value['options'] = options;

    const q = await this.db.query.questions.findFirst({
      where: eq(schema.questions.id, id),
    });

    if (!q) {
      const insertQuestion = await this.db
        .insert(schema.questions)
        .values(value)
        .onConflictDoUpdate({
          target: schema.questions.id,
          set: value,
        })
        .returning()
        .execute();
      return insertQuestion;
    } else {
      delete value.id;
      const updatedQuestion = await this.db
        .update(schema.questions)
        .set(value)
        .where(eq(schema.questions.id, id))
        .returning()
        .execute();
      return updatedQuestion;
    }
  }

  async getQuestionStatistics(questionId: string) {
    const res = {
      answered_count: 0,
      like_count: 0,
      correct_count: 0,
      incorrect_count: 0,
      dislike_count: 0,
    };

    const answeredCount = await this.db.query.question_attempts.findMany({
      where: eq(schema.question_attempts.question_id, questionId),
      columns: {
        choice_id: true,
      },
    });

    res.answered_count = answeredCount.length;

    const feedbackCount = await this.db.query.question_feedbacks.findMany({
      where: eq(schema.question_feedbacks.question_id, questionId),
      columns: {
        is_like: true,
      },
    });

    res.like_count = feedbackCount.filter(
      (item) => item.is_like === true,
    ).length;
    res.dislike_count = feedbackCount.filter(
      (item) => item.is_like === false,
    ).length;

    const question = await this.db.query.options.findFirst({
      where: eq(schema.options.question_id, questionId),
      columns: {
        options: true,
      },
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    if (typeof question.options === 'string') {
      question.options = JSON.parse(question.options);
    }

    const correctChoiceId = question.options.find(
      (item) => item.is_true === true,
    )?.id;

    if (!correctChoiceId) {
      return res;
    }

    const correctCount = answeredCount.filter(
      (item) => item.choice_id === correctChoiceId,
    );

    res.correct_count = correctCount.length;
    res.incorrect_count = res.answered_count - res.correct_count;

    return res;
  }
  async updateQuestionStatus(questionId: string, body: { status: boolean }) {
    const { status } = body;
    const question = await this.db
      .update(schema.questions)
      .set({ published: status, updated_at: new Date() })
      .where(eq(schema.questions.id, questionId))
      .returning({
        id: schema.questions.id,
      })
      .execute();
    return question;
  }
}
