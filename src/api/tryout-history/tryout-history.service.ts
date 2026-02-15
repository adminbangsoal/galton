import {
  CACHE_MANAGER,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DrizzleAsyncProvider } from '../../database/drizzle/drizzle.provider';
import * as schema from '../../database/schema';
import {
  and,
  eq,
  sql,
  asc,
  desc,
  lte,
  ne,
  or,
  inArray,
  isNotNull,
} from 'drizzle-orm';
import dayjs from 'dayjs';
import { S3Service } from '../../s3/s3.service';
import * as constant from './tryout-history.constant';
import UsersService from '../users/users.service';
import { Cache } from 'cache-manager';
import { SubjectAnalyticType, TotalUsersOfOption } from './tryout-history.type';
import TryoutWorkerService from '../../workers/tryout/tryout.service';
import axios from 'axios';

@Injectable()
class TryoutHistoryService {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
    private s3Service: S3Service,
    private userService: UsersService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private tryoutWorkerService: TryoutWorkerService,
  ) {}

  async getAllTryoutHistories(userId: string) {
    const tryoutHistories = await this.db
      .select({
        id: schema.tryouts.id,
        name: schema.tryouts.name,
        expiry_date: schema.tryouts.expiryDate,
        attempt_id: schema.tryout_attempts.id,
        started_at: schema.tryout_attempts.startedAt,
        submitted_at: schema.tryout_attempts.submittedAt,
        score: schema.tryout_attempts.score,
      })
      .from(schema.tryout_attempts)
      .where(
        and(
          eq(schema.tryout_attempts.userId, userId),
          // or(
          //   ne(schema.tryout_attempts.score, 0),
          //   isNotNull(schema.tryout_attempts.submittedAt)
          // ),
        ),
      )
      .innerJoin(
        schema.tryouts,
        and(
          eq(schema.tryout_attempts.tryoutId, schema.tryouts.id),
          lte(schema.tryouts.expiryDate, dayjs().subtract(2, 'day').toDate()), // remove TO histories that are not yet expired more than 2 days
        ),
      )
      .orderBy(desc(schema.tryout_attempts.submittedAt));

    return {
      tryouts: tryoutHistories,
    };
  }

  async getTryoutSetHistories(tryoutId: string, userId: string) {
    const tryout = await this.db.query.tryouts.findFirst({
      where: ({ id }, { eq }) => eq(id, tryoutId),
    });
    if (!tryout) throw new NotFoundException(`Tryout not found`);

    const tryoutAttempt = await this.getTryoutAttemptByTryoutIdAndUserId(
      tryoutId,
      userId,
    );
    if (!tryoutAttempt)
      throw new NotFoundException(`You have not attempt this tryout`);
    if (tryoutAttempt.score === null)
      throw new BadRequestException(
        `We are still calculating your tryout score, please wait.`,
      );

    const sets = await this.db
      .select({
        id: schema.tryout_sets.id,
        subject_id: schema.tryout_sets.subjectId,
        subject_name: schema.tryout_subjects.name,
      })
      .from(schema.tryout_sets)
      .where(eq(schema.tryout_sets.tryoutId, tryoutId))
      .innerJoin(
        schema.tryout_subjects,
        eq(schema.tryout_subjects.id, schema.tryout_sets.subjectId),
      )
      .orderBy(asc(schema.tryout_sets.createdAt));

    return { id: tryoutId, sets };
  }

  async getTryoutAttemptResult(tryoutId: string, userId: string) {
    const tryout = await this.db.query.tryouts.findFirst({
      where: ({ id }, { eq }) => eq(id, tryoutId),
    });
    if (!tryout) throw new NotFoundException(`Tryout not found`);

    const tryoutAttempt = await this.getTryoutAttemptByTryoutIdAndUserId(
      tryoutId,
      userId,
    );
    if (!tryoutAttempt)
      throw new NotFoundException(`You have not attempt this tryout`);
    if (tryoutAttempt.score === null)
      throw new BadRequestException(
        `We are still calculating your tryout score, please wait.`,
      );

    const questionAttempts = await this.db
      .selectDistinctOn([schema.tryout_questions.id], {
        id: schema.tryout_questions.id,
        options: schema.tryout_questions.options,
        selected_option_id: schema.tryout_question_attempts.optionId,
        is_flagged: schema.tryout_question_attempts.isFlagged,
        subject_name: schema.tryout_subjects.name,
      })
      .from(schema.tryout_sets)
      .where(eq(schema.tryout_sets.tryoutId, tryoutId))
      .innerJoin(
        schema.tryout_subjects,
        eq(schema.tryout_subjects.id, schema.tryout_sets.subjectId),
      )
      .innerJoin(
        schema.tryout_questions,
        and(
          eq(schema.tryout_questions.tryoutSetId, schema.tryout_sets.id),
          eq(schema.tryout_questions.isTextAnswer, false), // TEMPORARY ONLY, delete me in future dev. Currently only supports MCQ questions
        ),
      )
      .leftJoin(
        schema.tryout_question_attempts,
        and(
          eq(
            schema.tryout_questions.id,
            schema.tryout_question_attempts.tryoutQuestionId,
          ),
          eq(schema.tryout_question_attempts.userId, userId),
        ),
      )
      .orderBy(
        schema.tryout_questions.id,
        desc(schema.tryout_question_attempts.optionId), // if there is a case where user has attempted the question more than once
      );

    let totalCorrectAnswers = 0;
    let totalWrongAnswers = 0;
    let totalUnansweredQuestions = 0;

    const totalAnsweredQuestionsInSets: Record<string, number> = {};
    const totalQuestionsInSets: Record<string, number> = {};

    questionAttempts.forEach((questionAttempt) => {
      const subjectName = questionAttempt.subject_name;
      const isAnswered = questionAttempt.selected_option_id !== null; // null means user didn't answer this question

      if (typeof questionAttempt.options === 'string') {
        questionAttempt.options = JSON.parse(questionAttempt.options);
      }

      const isCorrectAnswer = isAnswered
        ? questionAttempt.options.find(
            (option) => option.id === questionAttempt.selected_option_id,
          ).is_true
        : false;

      if (!isAnswered) {
        totalUnansweredQuestions++;
        if (totalAnsweredQuestionsInSets[subjectName] == undefined)
          totalAnsweredQuestionsInSets[subjectName] = 0;
      } else {
        totalAnsweredQuestionsInSets[subjectName] =
          totalAnsweredQuestionsInSets[subjectName]
            ? (totalAnsweredQuestionsInSets[subjectName] =
                totalAnsweredQuestionsInSets[subjectName] + 1)
            : 1;

        if (isCorrectAnswer) {
          totalCorrectAnswers++;
        } else {
          totalWrongAnswers++;
        }
      }

      totalQuestionsInSets[subjectName] = totalQuestionsInSets[subjectName]
        ? (totalQuestionsInSets[subjectName] =
            totalQuestionsInSets[subjectName] + 1)
        : 1;
    });

    const setAttempts = await this.db
      .select({
        id: schema.tryout_sets.id,
        subject_name: schema.tryout_subjects.name,
        max_duration: schema.tryout_sets.duration,
        started_at: schema.tryout_set_attempts.startedAt,
        submitted_at: schema.tryout_set_attempts.submittedAt,
        score: schema.tryout_set_attempts.score,
      })
      .from(schema.tryout_sets)
      .where(eq(schema.tryout_sets.tryoutId, tryoutId))
      .innerJoin(
        schema.tryout_subjects,
        eq(schema.tryout_subjects.id, schema.tryout_sets.subjectId),
      )
      .leftJoin(
        schema.tryout_set_attempts,
        and(
          eq(schema.tryout_set_attempts.tryoutSetId, schema.tryout_sets.id),
          eq(schema.tryout_set_attempts.userId, userId),
        ),
      );

    const formattedSetAttempts = setAttempts.map((setAttempt) => {
      let completionTime: number; // in seconds

      if (setAttempt.started_at && setAttempt.submitted_at) {
        completionTime = dayjs(setAttempt.submitted_at).diff(
          dayjs(setAttempt.started_at),
        );
      } else if (setAttempt.started_at && !setAttempt.submitted_at) {
        const setMaxSubmittedAt = dayjs(setAttempt.started_at).add(
          setAttempt.max_duration,
          'second',
        );
        const tryoutSubmittedAt = dayjs(tryoutAttempt.submittedAt);
        const minSubmittedAt = tryoutSubmittedAt.isBefore(setMaxSubmittedAt)
          ? tryoutSubmittedAt
          : setMaxSubmittedAt;
        completionTime = dayjs(minSubmittedAt).diff(
          dayjs(setAttempt.started_at),
        );
      } else {
        completionTime = setAttempt.max_duration;
      }

      return {
        id: setAttempt.id,
        subject_name: setAttempt.subject_name,
        completion_time: Math.floor(completionTime / 60), // in minutes
        max_duration: Math.floor(setAttempt.max_duration / 60), // in minutes
        answered_questions:
          totalAnsweredQuestionsInSets[setAttempt.subject_name] ?? 0,
        total_questions: totalQuestionsInSets[setAttempt.subject_name] ?? 0,
        score: setAttempt.score ? Number(setAttempt.score.toFixed(0)) : 0,
      };
    });

    const totalAnsweredQuestions = totalCorrectAnswers + totalWrongAnswers;
    const totalQuestions = questionAttempts.length;

    return {
      id: tryout.id,
      name: tryout.name,
      score: tryoutAttempt.score,
      total_correct_answers: totalCorrectAnswers,
      total_wrong_answers: totalWrongAnswers,
      total_unanswered_questions: totalQuestions - totalAnsweredQuestions,
      total_questions: totalQuestions,
      set_results: formattedSetAttempts,
    };
  }

  async getTryoutAttemptByTryoutIdAndUserId(tryoutId: string, userId: string) {
    const tryoutAttempt = await this.db.query.tryout_attempts.findFirst({
      where: (attempt, { eq, and }) =>
        and(
          eq(attempt.tryoutId, tryoutId),
          eq(attempt.userId, userId),
          lte(attempt.submittedAt, new Date()),
        ),
    });

    return tryoutAttempt;
  }

  async getQuestionHistoriesOfSet(setId: string, userId: string) {
    const tryoutSets = await this.db
      .select({
        id: schema.tryout_sets.id,
        tryout_id: schema.tryout_sets.tryoutId,
        subject_id: schema.tryout_sets.subjectId,
        subject_name: schema.tryout_subjects.name,
      })
      .from(schema.tryout_sets)
      .where(eq(schema.tryout_sets.id, setId))
      .innerJoin(
        schema.tryout_subjects,
        eq(schema.tryout_subjects.id, schema.tryout_sets.subjectId),
      )
      .limit(1);
    if (!tryoutSets.length) throw new NotFoundException(`Tryout set not found`);
    const tryoutSet = tryoutSets[0];
    const tryoutId = tryoutSet.tryout_id;

    const tryoutAttempt = await this.getTryoutAttemptByTryoutIdAndUserId(
      tryoutId,
      userId,
    );
    if (!tryoutAttempt)
      throw new NotFoundException(`You have not attempt this tryout`);
    if (tryoutAttempt.score === null)
      throw new BadRequestException(
        `We are still calculating your tryout score, please wait.`,
      );

    const questionAttempts = await this.db
      .selectDistinctOn([schema.tryout_questions.id], {
        id: schema.tryout_questions.id,
        type: schema.tryout_questions.type,
        filled_answers: schema.tryout_question_attempts.filledAnswers,
        options: schema.tryout_questions.options,
        is_text_answer: schema.tryout_questions.isTextAnswer,
        answer: schema.tryout_question_attempts.answer,
        selected_option_id: schema.tryout_question_attempts.optionId,
        is_flagged: schema.tryout_question_attempts.isFlagged,
      })
      .from(schema.tryout_questions)
      .where(and(eq(schema.tryout_questions.tryoutSetId, tryoutSet.id)))
      .leftJoin(
        schema.tryout_question_attempts,
        and(
          eq(
            schema.tryout_questions.id,
            schema.tryout_question_attempts.tryoutQuestionId,
          ),
          eq(schema.tryout_question_attempts.userId, userId),
        ),
      )
      .orderBy(
        schema.tryout_questions.id,
        desc(schema.tryout_question_attempts.optionId), // if there is a case where user has attempted the question more than once
        asc(schema.tryout_questions.createdAt),
      );

    let totalCorrectAnswers = 0;
    let totalWrongAnswers = 0;
    let totalUnansweredQuestions = 0;
    const formattedQuestions = questionAttempts.map((questionAttempt) => {
      const isAnswered =
        questionAttempt.answer !== null ||
        (questionAttempt.type !== 'multiple-choice' &&
          !!questionAttempt.filled_answers); // null means user didn't answer this question. If MCQ, the value is the option content

      if (typeof questionAttempt.options === 'string') {
        questionAttempt.options = JSON.parse(questionAttempt.options);
      }

      const selectedAnswer = questionAttempt.options.find(({ id, content }) => {
        if (questionAttempt.is_text_answer)
          return content === questionAttempt.answer;
        else return id === questionAttempt?.selected_option_id; // MCQ
      });

      const isCorrectAnswer = selectedAnswer ? selectedAnswer.is_true : false;

      if (!isAnswered) {
        totalUnansweredQuestions++;
      } else if (isCorrectAnswer) {
        totalCorrectAnswers++;
      } else {
        totalWrongAnswers++;
      }

      return {
        id: questionAttempt.id,
        is_answered: isAnswered,
        is_correct: isCorrectAnswer,
        is_flagged: questionAttempt.is_flagged,
      };
    });

    return {
      ...tryoutSet,
      correct_answers: totalCorrectAnswers,
      wrong_answers: totalWrongAnswers,
      unanswered_questions: totalUnansweredQuestions,
      questions: formattedQuestions,
    };
  }

  async getTryoutAttemptByQuestionIdAndUserId(
    questionId: string,
    userId: string,
  ) {
    const tryoutAttempts = await this.db
      .select()
      .from(schema.tryout_questions)
      .where(eq(schema.tryout_questions.id, questionId))
      .innerJoin(
        schema.tryout_sets,
        eq(schema.tryout_sets.id, schema.tryout_questions.tryoutSetId),
      )
      .innerJoin(
        schema.tryout_subjects,
        eq(schema.tryout_subjects.id, schema.tryout_sets.subjectId),
      )
      .innerJoin(
        schema.tryout_attempts,
        and(
          eq(schema.tryout_attempts.tryoutId, schema.tryout_sets.tryoutId),
          eq(schema.tryout_attempts.userId, userId),
          lte(schema.tryout_attempts.submittedAt, new Date()),
        ),
      )
      .limit(1);
    return tryoutAttempts.length ? tryoutAttempts[0] : null;
  }

  async getQuestionDetails(questionId: string, userId: string) {
    const question = await this.db.query.tryout_questions.findFirst({
      where: ({ id }, { eq }) => eq(id, questionId),
    });
    if (!question) throw new NotFoundException(`Tryout question not found`);

    const tryoutAttempt = await this.getTryoutAttemptByQuestionIdAndUserId(
      questionId,
      userId,
    );
    if (!tryoutAttempt)
      throw new UnauthorizedException(
        `You have not attempt the corresponding tryout`,
      );
    const tryoutScore = tryoutAttempt.tryout_attempts.score;
    const subjectName = tryoutAttempt.tryout_subjects.name;
    if (tryoutScore === null)
      throw new BadRequestException(
        `We are still calculating your tryout score, please wait.`,
      );

    const questionAttempt =
      await this.db.query.tryout_question_attempts.findFirst({
        where: (attempt, { and, eq }) =>
          and(
            eq(attempt.tryoutQuestionId, questionId),
            eq(attempt.userId, userId),
          ),
      });

    if (typeof question.options === 'string') {
      question.options = JSON.parse(question.options);
    }

    const selectedAnswer = question.options.find(({ id, content }) => {
      if (question.isTextAnswer) return content === questionAttempt?.answer;
      else return id === questionAttempt?.optionId; // MCQ
    });

    const isCorrectAnswer =
      questionAttempt && selectedAnswer ? selectedAnswer.is_true : false;

    return {
      id: questionId,
      type: question.type,
      filled_answers: questionAttempt.filledAnswers,
      answers: question.answers,
      content_image: question.contentImage,
      content: question.content,
      options: question.options.map(({ asset, ...other }) => other),
      is_text_answer: question.isTextAnswer,
      answer: questionAttempt ? questionAttempt.answer : null,
      option_id: questionAttempt ? questionAttempt.optionId : null,
      is_correct: isCorrectAnswer,
      subject_name: subjectName,
    };
  }

  async getQuestionNotes(questionId: string, userId: string) {
    const question = await this.db.query.tryout_questions.findFirst({
      where: ({ id }, { eq }) => eq(id, questionId),
    });
    if (!question) throw new NotFoundException(`Tryout question not found`);

    const tryoutAttempt = await this.getTryoutAttemptByQuestionIdAndUserId(
      questionId,
      userId,
    );
    if (!tryoutAttempt)
      throw new UnauthorizedException(
        `You have not attempt the corresponding tryout`,
      );
    const tryoutScore = tryoutAttempt.tryout_attempts.score;
    if (tryoutScore === null)
      throw new BadRequestException(
        `We are still calculating your tryout score, please wait.`,
      );

    const questionNotes = await this.db
      .select({
        id: schema.tryout_question_notes.id,
        asset_url: schema.tryout_question_notes.assetUrl,
      })
      .from(schema.tryout_question_notes)
      .where(
        and(
          eq(schema.tryout_question_notes.tryoutQuestionId, questionId),
          eq(schema.tryout_question_notes.userId, userId),
        ),
      );

    for (let i = 0; i < questionNotes.length; i++) {
      const key = this.s3Service.getObjectKeyFromUrl(
        questionNotes[i].asset_url,
      );
      if (key) {
        const url = await this.s3Service.getPresignedUrl(key);
        questionNotes[i].asset_url = url;
      } else {
        questionNotes[i].asset_url = null;
      }
    }

    return {
      question_id: questionId,
      notes: questionNotes,
    };
  }

  async getQuestionExplanation(questionId: string, userId: string) {
    const isUserSubscribed = await this.userService.isSubscribed(userId);
    if (!isUserSubscribed) {
      return {
        id: null,
        content: null,
        content_image: null,
        question_id: null,
        is_liked: null,
      };
    }
    const question = await this.db.query.tryout_questions.findFirst({
      where: ({ id }, { eq }) => eq(id, questionId),
    });
    if (!question) throw new NotFoundException(`Tryout question not found`);

    const tryoutAttempt = await this.getTryoutAttemptByQuestionIdAndUserId(
      questionId,
      userId,
    );
    if (!tryoutAttempt)
      throw new UnauthorizedException(
        `You have not attempt the corresponding tryout`,
      );
    const tryoutScore = tryoutAttempt.tryout_attempts.score;
    if (tryoutScore === null)
      throw new BadRequestException(
        `We are still calculating your tryout score, please wait.`,
      );

    const explanation = await this.db.query.tryout_pembahasan.findFirst({
      where: (exp, { eq }) => eq(exp.tryoutQuestionId, questionId),
      columns: {
        id: true,
        content: true,
        contentImage: true,
        tryoutQuestionId: true,
      },
    });

    if (!explanation) return null;

    if (explanation.contentImage) {
      const key = this.s3Service.getObjectKeyFromUrl(explanation.contentImage);
      if (key) {
        const url = await this.s3Service.getPresignedUrl(key);
        explanation.contentImage = url;
      } else {
        explanation.contentImage = null;
      }
    }

    const explanationFeedback =
      await this.db.query.tryout_pembahasan_feedback.findFirst({
        where: (feedback, { eq }) =>
          and(
            eq(feedback.tryoutQuestionId, questionId),
            eq(feedback.userId, userId),
          ),
      });

    return {
      id: explanation.id,
      content: explanation.content,
      content_image: explanation.contentImage,
      question_id: explanation.tryoutQuestionId,
      is_liked: explanationFeedback ? explanationFeedback.isLiked : null,
    };
  }

  async addExplanationFeedback(
    questionId: string,
    userId: string,
    isLiked: boolean,
  ) {
    const isUserSubscribed = this.userService.isSubscribed(userId);
    if (!isUserSubscribed)
      throw new UnauthorizedException(`Your account is not premium`);

    const tryoutAttempt = await this.getTryoutAttemptByQuestionIdAndUserId(
      questionId,
      userId,
    );
    if (!tryoutAttempt)
      throw new UnauthorizedException(
        `You have not attempt the corresponding tryout`,
      );
    const tryoutScore = tryoutAttempt.tryout_attempts.score;
    if (tryoutScore === null)
      throw new BadRequestException(
        `We are still calculating your tryout score, please wait.`,
      );

    const explanation = await this.db.query.tryout_pembahasan.findFirst({
      where: ({ tryoutQuestionId }, { eq }) => eq(tryoutQuestionId, questionId),
    });
    if (!explanation)
      throw new NotFoundException(`Tryout question explanation not found`); // must not happen. Every question needs to have an explanation

    const explanationFeedback =
      await this.db.query.tryout_pembahasan_feedback.findFirst({
        where: (feedback, { eq }) =>
          and(
            eq(feedback.tryoutQuestionId, questionId),
            eq(feedback.userId, userId),
          ),
      });

    if (!!explanationFeedback) {
      // previously user has liked/disliked
      if (explanationFeedback.isLiked === isLiked) return explanationFeedback; // nothing to update

      const updatedFeedback = await this.db
        .update(schema.tryout_pembahasan_feedback)
        .set({
          isLiked,
        })
        .where(eq(schema.tryout_pembahasan_feedback.id, explanationFeedback.id))
        .returning();

      return updatedFeedback[0];
    } else {
      // it's the first time user liked/disliked this explanation
      const createdFeedback = await this.db
        .insert(schema.tryout_pembahasan_feedback)
        .values({
          tryoutQuestionId: questionId,
          userId: userId,
          isLiked: isLiked,
          timestamp: new Date(),
        })
        .returning();

      return createdFeedback[0];
    }
  }

  async addQuestionNote(questionId: string, userId: string, assetUrl: string) {
    const question = await this.db.query.tryout_questions.findFirst({
      where: ({ id }, { eq }) => eq(id, questionId),
    });
    if (!question) throw new NotFoundException(`Tryout question not found`);

    const tryoutAttempt = await this.getTryoutAttemptByQuestionIdAndUserId(
      questionId,
      userId,
    );
    if (!tryoutAttempt)
      throw new UnauthorizedException(
        `You have not attempt the corresponding tryout`,
      );
    const tryoutScore = tryoutAttempt.tryout_attempts.score;
    if (tryoutScore === null)
      throw new BadRequestException(
        `We are still calculating your tryout score, please wait.`,
      );

    const createdNote = await this.db
      .insert(schema.tryout_question_notes)
      .values({
        tryoutQuestionId: questionId,
        userId: userId,
        assetUrl: assetUrl,
        createdAt: new Date(),
      })
      .returning();

    return createdNote[0];
  }

  async getQuestionAnalytics(questionId: string, userId: string) {
    const user = await this.db.query.users.findFirst({
      where: ({ id }, { eq }) => eq(id, userId),
      columns: {
        validity_date: true,
        choosen_university_one: true,
      },
    });

    const isUserSubscribed = dayjs(user.validity_date).isAfter(dayjs());
    if (!isUserSubscribed) {
      return {
        tryout_id: null,
        question_id: null,
        answer_distribution: {
          all: null,
          chosen_university: null,
        },
        total_user_answered: null,
        correct_answer_percentage: null,
        difficulty_level: null,
        source: {
          name: null,
          year: null,
        },
        correct_key: null,
      };
    }

    const tryoutQuestion = await this.db.query.tryout_questions.findFirst({
      where: ({ id }, { eq }) => eq(id, questionId),
    });
    if (!tryoutQuestion)
      throw new NotFoundException(`Tryout question not found`);

    // parse options
    if (typeof tryoutQuestion.options === 'string') {
      tryoutQuestion.options = JSON.parse(tryoutQuestion.options);
    }

    tryoutQuestion.options.sort((a, b) =>
      a.key.toLowerCase().localeCompare(b.key.toLowerCase()),
    ); // sort options in this order: a, b, c, d

    const tryoutAttempt = await this.getTryoutAttemptByQuestionIdAndUserId(
      questionId,
      userId,
    );
    if (!tryoutAttempt)
      throw new UnauthorizedException(
        `You have not attempt the corresponding tryout`,
      );
    const tryoutScore = tryoutAttempt.tryout_attempts.score;
    if (tryoutScore === null)
      throw new BadRequestException(
        `We are still calculating your tryout score, please wait.`,
      );

    const tryoutId = tryoutAttempt.tryout_attempts.tryoutId;

    // 1. stacked chart peserta lain jawab pilihan mana
    // get all question attempts group by optionId, count userId
    const cachedTotalUsersOfEachAnswer: TotalUsersOfOption[] | undefined =
      await this.cacheManager.get(
        `tryout-question:${questionId}:analytics:total-users`,
      );

    const totalUsersOfEachAnswer: TotalUsersOfOption[] =
      cachedTotalUsersOfEachAnswer ??
      (await this.db
        .select({
          option_id: schema.tryout_question_attempts.optionId,
          total_users: sql<number>`cast(count(${schema.tryout_question_attempts.userId}) as int)`,
        })
        .from(schema.tryout_question_attempts)
        .where(
          eq(
            schema.tryout_question_attempts.tryoutQuestionId,
            tryoutQuestion.id,
          ),
        )
        .groupBy(schema.tryout_question_attempts.optionId));

    if (!cachedTotalUsersOfEachAnswer) {
      await this.cacheManager.set(
        `tryout-question:${questionId}:analytics:total-users`,
        totalUsersOfEachAnswer,
        60 * 60 * 12,
      );
    }

    const totalUsersThatAttemptedTO = await this.db
      .select({
        tryout_id: schema.tryout_attempts.tryoutId,
        total_users: sql<number>`cast(count(${schema.tryout_attempts.userId}) as int)`,
      })
      .from(schema.tryout_attempts)
      .where(eq(schema.tryout_attempts.tryoutId, tryoutId))
      .groupBy(schema.tryout_attempts.tryoutId);
    const formattedTotalUsers: {
      key: string;
      users_percentage: string;
    }[] = tryoutQuestion.options.map((option) => {
      const totalUsersOfOption = totalUsersOfEachAnswer.find(
        (totalUsers) => totalUsers.option_id === option.id,
      );
      const totalUsers = totalUsersOfOption
        ? totalUsersOfOption.total_users
        : 0; // set to zero if no one chose this option
      const usersPercentage =
        (totalUsers / totalUsersThatAttemptedTO[0].total_users) * 100;
      return {
        key: option.key,
        users_percentage: usersPercentage.toFixed(2),
      };
    });

    // 2. persentase orang jawab bener
    // get optionId yg correct (is_true) dr question
    // ambil count nya dr no 1

    const correctOption = tryoutQuestion.options.find(
      (option) => option.is_true,
    );
    const correctUsers = totalUsersOfEachAnswer.find(
      (total) => total.option_id === correctOption.id,
    );

    const correctAnswerPercentage =
      (correctUsers?.total_users ?? 0) /
      totalUsersThatAttemptedTO[0].total_users;

    // 3. kategori (mudah/normal/sulit) [dihitung dari brp persentase yg bener(?)]
    // dr persentase no 2, define ke threshold
    let difficultyLevel: string = 'MUDAH';
    if (correctAnswerPercentage <= constant.HARD_QUESTION_THRESHOLD) {
      difficultyLevel = 'SULIT';
    } else if (correctAnswerPercentage <= constant.NORMAL_QUESTION_THRESHOLD) {
      difficultyLevel = 'NORMAL';
    }

    // 4. stacked chart peserta dengan pilihan PTN sama jawab pilihan mana
    // get all question attempts inner join user where PTN = user.PTN, group by optionId, count userId
    const cachedTotalUsersWithSameChosenUniOfEachAnswer:
      | TotalUsersOfOption[]
      | undefined = await this.cacheManager.get(
      `tryout-question:${questionId}:analytics:total-users:university:${user.choosen_university_one}`,
    );

    const totalUsersWithSameChosenUniOfEachAnswer: TotalUsersOfOption[] =
      cachedTotalUsersWithSameChosenUniOfEachAnswer ??
      (await this.db
        .select({
          option_id: schema.tryout_question_attempts.optionId,
          total_users: sql<number>`cast(count(${schema.tryout_question_attempts.userId}) as int)`,
        })
        .from(schema.tryout_question_attempts)
        .where(
          eq(
            schema.tryout_question_attempts.tryoutQuestionId,
            tryoutQuestion.id,
          ),
        )
        .innerJoin(
          schema.users,
          and(
            eq(schema.users.id, schema.tryout_question_attempts.userId),
            eq(
              schema.users.choosen_university_one,
              user.choosen_university_one,
            ),
          ),
        )
        .groupBy(schema.tryout_question_attempts.optionId));

    if (!cachedTotalUsersWithSameChosenUniOfEachAnswer) {
      await this.cacheManager.set(
        `tryout-question:${questionId}:analytics:total-users:university:${user.choosen_university_one}`,
        totalUsersWithSameChosenUniOfEachAnswer,
        60 * 60 * 12,
      );
    }

    const totalTryoutAttemptsFromChosenUni = await this.db
      .select({
        total_users: sql<number>`cast(count(${schema.tryout_attempts.userId}) as int)`,
      })
      .from(schema.tryout_attempts)
      .where(and(eq(schema.tryout_attempts.tryoutId, tryoutId)))
      .innerJoin(
        schema.users,
        and(
          eq(schema.users.id, schema.tryout_attempts.userId),
          eq(schema.users.choosen_university_one, user.choosen_university_one),
        ),
      );

    const formattedTotalUsersWithSameChosenUni: {
      key: string;
      users_percentage: string;
    }[] = tryoutQuestion.options.map((option) => {
      const totalUsersOfOption = totalUsersWithSameChosenUniOfEachAnswer.find(
        (totalUsers) => totalUsers.option_id === option.id,
      );
      const totalUsers = totalUsersOfOption
        ? totalUsersOfOption.total_users
        : 0; // set to zero if no one chose this option
      const usersPercentage =
        (totalUsers / totalTryoutAttemptsFromChosenUni[0].total_users) * 100;
      return {
        key: option.key,
        users_percentage: usersPercentage.toFixed(2),
      };
    });

    // 5. sumber soalnya (dari ujian mana dan tahun apa dll)
    const source = tryoutQuestion.source;
    const originalQuestion = await this.db.query.questions.findFirst({
      where: ({ id }, { eq }) => eq(id, tryoutQuestion.questionId),
    });
    const year = originalQuestion.year;

    const topic = await this.db
      .select({
        name: schema.topics.name,
      })
      .from(schema.topics)
      .where(eq(schema.topics.id, originalQuestion.topic_id));

    return {
      tryout_id: tryoutId,
      question_id: questionId,
      answer_distribution: {
        // it is guaranteed that all options are included here.
        all: formattedTotalUsers,
        chosen_university: formattedTotalUsersWithSameChosenUni,
      },
      total_user_answered: formattedTotalUsers.reduce(
        (acc, { users_percentage }) => acc + Number(users_percentage),
        0,
      ),
      correct_answer_percentage: (correctAnswerPercentage * 100).toFixed(2),
      difficulty_level: difficultyLevel,
      source: {
        name: source,
        year: year,
      },
      topic: topic.length ? topic[0].name : null,
      correct_key: correctOption.key,
    };
  }

  async addTryoutScoreCalculationJob(tryoutId: string) {
    const tryout = await this.db.query.tryouts.findFirst({
      where: eq(schema.tryouts.id, tryoutId),
    });

    if (!tryout) throw new NotFoundException('Tryout not found');

    const executeAt = new Date();
    await this.tryoutWorkerService.addJob(executeAt, tryoutId);

    return {
      execute_at: executeAt,
      tryout_id: tryoutId,
    };
  }

  async removeTryoutScoreCalculationJob(tryoutId: string) {
    const tryout = await this.db.query.tryouts.findFirst({
      where: eq(schema.tryouts.id, tryoutId),
    });

    if (!tryout) throw new NotFoundException('Tryout not found');

    const executeAt = dayjs(tryout.expiryDate).add(1, 'day').toDate();
    await this.tryoutWorkerService.removeJob(executeAt, tryoutId);

    return {
      execute_at: executeAt,
      tryout_id: tryoutId,
    };
  }

  async getTryoutScoreAnalytics(userId: string) {
    // TODO (for next dev): get all TO left join to attempts, order by TO created at
    const tryoutAttempts = await this.db // TODO (for next dev): consist of tryouts without attempt too
      .select({
        tryout_id: schema.tryouts.id,
        name: schema.tryouts.name,
        score: schema.tryout_attempts.score,
        expiry_date: schema.tryouts.expiryDate,
      })
      .from(schema.tryouts)
      .innerJoin(
        schema.tryout_attempts,
        and(
          eq(schema.tryout_attempts.userId, userId),
          eq(schema.tryout_attempts.tryoutId, schema.tryouts.id),
        ),
      )
      .orderBy(asc(schema.tryouts.createdAt));

    if (!tryoutAttempts.length)
      return {
        tryouts: [], // yg kotak ijo di kanan
        attempts: [], // buat grafik
        average_score: 0,
        max_score: 0,
        min_score: 0,
        finished_tryouts: 0,
        total_tryouts: 0,
      };

    const attemptScores: {
      // consist of attempted tryouts only, for displaying it in graph
      tryout_id: string;
      name: string;
      score: number;
    }[] = [];
    let sumScore = 0;
    let maxScore = 0;
    let minScore = Number.MAX_SAFE_INTEGER;

    const formattedTryouts: {
      // consist of all available tryouts
      tryout_id: string;
      name: string;
      score: number;
      expiry_date: Date;
    }[] = [];

    const currentDate = new Date();

    tryoutAttempts.forEach((attempt) => {
      if (attempt.score !== null) {
        sumScore += attempt.score;
        maxScore = Math.max(attempt.score, maxScore);
        minScore = Math.min(attempt.score, minScore);

        attemptScores.push({
          tryout_id: attempt.tryout_id,
          name: attempt.name,
          score: attempt.score,
        });
      }

      if (attempt.score !== null || attempt.expiry_date > currentDate)
        formattedTryouts.push({
          tryout_id: attempt.tryout_id,
          name: attempt.name,
          score: attempt.score,
          expiry_date: attempt.expiry_date,
        });
    });

    const averageScore = sumScore / attemptScores.length;

    return {
      tryouts: formattedTryouts, // yg kotak ijo di kanan
      attempts: attemptScores, // buat grafik
      average_score: averageScore,
      max_score: maxScore,
      min_score: minScore,
      finished_tryouts: attemptScores.length,
      total_tryouts: formattedTryouts.length,
    };
  }

  async getTryoutSubjectAnalytics(userId: string) {
    // get map of all subjects
    const tryoutSubjects = await this.db.select().from(schema.tryout_subjects);

    const subjectMap: { [subjectId: string]: SubjectAnalyticType } =
      tryoutSubjects.reduce((map, subject) => {
        map[subject.id] = {
          id: subject.id,
          name: subject.name,
          set_count: 0,
          avg_score: 0,
          max_score: 0,
          min_score: Number.MAX_SAFE_INTEGER,
          topics: [],
        };
        return map;
      }, {});

    const setAttempts = await this.db // to get max min score of set per subject
      .select({
        id: schema.tryout_set_attempts.id,
        score: schema.tryout_set_attempts.score,
        tryoutSetId: schema.tryout_set_attempts.tryoutSetId,
        subjectId: schema.tryout_sets.subjectId,
      })
      .from(schema.tryout_set_attempts)
      .where(eq(schema.tryout_set_attempts.userId, userId))
      .innerJoin(
        schema.tryout_sets,
        eq(schema.tryout_sets.id, schema.tryout_set_attempts.tryoutSetId),
      );

    if (!setAttempts.length) return null;

    const setIds = [];

    setAttempts.forEach((attempt) => {
      // determine avg, min, max scores of subject
      const subject = subjectMap[attempt.subjectId];

      const sumScore = subject.avg_score * subject.set_count + attempt.score;
      subject.set_count++;
      subject.avg_score = sumScore / subject.set_count;

      subject.max_score = Math.max(attempt.score, subject.max_score);
      subject.min_score = Math.min(attempt.score, subject.min_score);

      setIds.push(attempt.tryoutSetId);
    });

    const correctAnswerRatio = await this.db // ratio per topic per subject
      .select({
        subjectId: schema.tryout_sets.subjectId,
        topicId: schema.topics.id,
        topicName: schema.topics.name,
        // TODO: need to change query to count correct answers since q_attempt.score wont be used anymore.
        correctAnswersCount: sql<number>`cast(count(case when ${schema.tryout_question_attempts.score} > 0 then ${schema.tryout_question_attempts.id} end) as int)`,
        questionsCount: sql<number>`cast(count(${schema.tryout_questions.id}) as int)`,
      })
      .from(schema.topics)
      .innerJoin(
        schema.questions,
        eq(schema.topics.id, schema.questions.topic_id),
      )
      .innerJoin(
        schema.tryout_questions,
        and(
          eq(schema.tryout_questions.questionId, schema.questions.id),
          inArray(schema.tryout_questions.tryoutSetId, setIds),
        ),
      )
      .innerJoin(
        schema.tryout_sets,
        eq(schema.tryout_sets.id, schema.tryout_questions.tryoutSetId),
      )
      .leftJoin(
        schema.tryout_question_attempts,
        and(
          eq(
            schema.tryout_question_attempts.tryoutQuestionId,
            schema.tryout_questions.id,
          ),
          eq(schema.tryout_question_attempts.userId, userId),
        ),
      )
      .groupBy(
        schema.tryout_sets.subjectId,
        schema.topics.id,
        schema.topics.name,
      );

    correctAnswerRatio.forEach((ratio) => {
      const subject = subjectMap[ratio.subjectId];
      subject.topics.push({
        id: ratio.topicId,
        name: ratio.topicName,
        correct_answers_count: ratio.correctAnswersCount,
        questions_count: ratio.questionsCount,
      });
    });

    const formattedSubjectMap: { [subjectName: string]: SubjectAnalyticType } =
      {};

    // make the subject name as the key
    Object.keys(subjectMap).forEach((subjectId) => {
      const subjectName = subjectMap[subjectId].name;
      if (formattedSubjectMap[subjectName]) {
        console.error(
          `${dayjs().toISOString()}: tryout-subject-analytics - duplicate tryout subject name: '${subjectName}' ('${
            formattedSubjectMap[subjectName].id
          }' and '${subjectId}')`,
        );
        throw new InternalServerErrorException(
          `Duplicate tryout subject name: '${subjectName}'`,
        );
      }
      formattedSubjectMap[subjectName] = subjectMap[subjectId];
    });

    return { subject_analytics: formattedSubjectMap };
  }
}

export default TryoutHistoryService;
