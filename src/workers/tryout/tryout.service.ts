import { Inject, Injectable, Logger } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DrizzleAsyncProvider } from '../../database/drizzle/drizzle.provider';
import * as schema from '../../database/schema';
import { eq, sql, inArray, and } from 'drizzle-orm';
import dayjs from 'dayjs';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QuestionAttemptType, QuestionType } from './tryout.type';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { TryoutTypeEnum } from '../../api/tryout-cms/tryout-cms.enum';

@Injectable()
class TryoutWorkerService {
  private readonly logger = new Logger(TryoutWorkerService.name);

  constructor(
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
    @InjectRedis() private readonly redis: Redis,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async addJob(executeAt: Date, tryoutId: string) {
    await this.redis.zadd(
      'calculateTryoutScoresJobs',
      executeAt.getTime().toString(), // in milliseconds
      tryoutId,
    );
  }

  async removeJob(executeAt: Date, tryoutId: string) {
    await this.redis.zrem(
      'calculateTryoutScoresJobs',
      executeAt.getTime().toString(), // in milliseconds
      tryoutId,
    );
  }

  async peekEarliestJob() {
    const nextJob = await this.redis.zrange(
      'calculateTryoutScoresJobs',
      0,
      0,
      'WITHSCORES',
    ); // fetch earliest execution time
    if (!nextJob.length) return null;
    const executeAt = dayjs(parseInt(nextJob[1])); // parse score (execute_at in string in milliseconds) to dayjs
    return {
      executeAt: executeAt.toDate(),
      tryoutId: nextJob[0], // member
    };
  }

  async removeEarliestJob() {
    // pop operation
    const nextJob = await this.redis.zrange(
      'calculateTryoutScoresJobs',
      0,
      0,
      'WITHSCORES',
    ); // fetch earliest execution time
    if (!nextJob.length) return null;
    await this.redis.zremrangebyrank('calculateTryoutScoresJobs', 0, 0);
    const executeAt = dayjs(parseInt(nextJob[1])); // parse score (execute_at in string in milliseconds) to dayjs
    return {
      executeAt: executeAt.toDate(),
      tryoutId: nextJob[0], // member
    };
  }

  @Cron(CronExpression.EVERY_HOUR, {
    name: 'calculate-tryout-scores',
    timeZone: 'Asia/Jakarta',
  })
  async calculateScoresOfEarliestTryout() {
    const earliestJob = await this.peekEarliestJob();
    if (!earliestJob) return; // queue is empty

    const executeJobAt = dayjs(earliestJob.executeAt);
    const currentTime = dayjs();
    const runningJob = await this.cacheManager.get(
      'calculateTryoutScoresJobsIsRunning',
    );

    if (runningJob) return; // job is already running
    else
      await this.cacheManager.set('calculateTryoutScoresJobsIsRunning', true); // set job is running

    if (executeJobAt.isBefore(currentTime)) {
      const tryoutId = earliestJob.tryoutId;
      try {
        this.logger.log(
          `${dayjs().toISOString()}: calculate-tryout-score - Tryout ID: ${tryoutId} - start`,
        );
        await this.calculateUsersTryoutScores(tryoutId);
        this.logger.log(
          `${dayjs().toISOString()}: calculate-tryout-score - Tryout ID: ${tryoutId} - finished`,
        );
      } catch (err) {
        this.logger.error(
          `${dayjs().toISOString()}: calculate-tryout-score - Tryout ID: ${tryoutId} - ERROR: ${
            err.message
          }`,
        );
        this.logger.error(err.stack);
      }
      await this.removeEarliestJob();
      await this.cacheManager.del('calculateTryoutScoresJobsIsRunning'); // set job is not running
    }
  }

  async calculateUsersTryoutScores(tryoutId: string) {
    const tryout = await this.db.query.tryouts.findFirst({
      where: ({ id }, { eq }) => eq(id, tryoutId),
    });

    if (!tryout) throw new Error(`Tryout not found`);
    const tryoutAttempts = await this.db
      .select({
        id: schema.tryout_attempts.id,
        userId: schema.tryout_attempts.userId,
      })
      .from(schema.tryout_attempts)
      .where(eq(schema.tryout_attempts.tryoutId, tryoutId));

    if (!tryoutAttempts.length) {
      this.logger.log(
        `${dayjs().toISOString()}: calculate-tryout-score - Tryout ID: ${tryoutId} - no user attempts`,
      );
      return;
    }
    const tryoutSets = await this.db
      .select({
        id: schema.tryout_sets.id,
      })
      .from(schema.tryout_sets)
      .where(eq(schema.tryout_sets.tryoutId, tryoutId));

    const tryoutSetIds = tryoutSets.map(({ id }) => id);

    const userSetScores: { [userId: string]: { [setId: string]: number } } =
      tryoutAttempts.reduce((map, tAttempt) => {
        const defaultSetScores: { [setId: string]: number } = tryoutSets.reduce(
          (map, set) => {
            map[set.id] = 0; // set default score to zero. Will be added afterwards after each question attempt scores have been calculated
            return map;
          },
          {},
        );

        map[tAttempt.userId] = defaultSetScores;
        return map;
      }, {});

    const totalTryoutAttempts = tryoutAttempts.length; // equivalent to total users
    const questions = await this.db
      .select({
        id: schema.tryout_questions.id,
        tryoutSetId: schema.tryout_questions.tryoutSetId,
        options: schema.tryout_questions.options,
        isTextAnswer: schema.tryout_questions.isTextAnswer,
        correctScoreWeight: schema.tryout_questions.correctScoreWeight,
        wrongScoreWeight: schema.tryout_questions.wrongScoreWeight,
        correctFilledAnswers: schema.tryout_questions.answers,
        type: schema.tryout_questions.type,
      })
      .from(schema.tryout_sets)
      .where(eq(schema.tryout_sets.tryoutId, tryoutId))
      .innerJoin(
        schema.tryout_questions,
        eq(schema.tryout_questions.tryoutSetId, schema.tryout_sets.id),
      );

    if (!questions.length) {
      this.logger.log(
        `${dayjs().toISOString()}: calculate-tryout-score - Tryout ID: ${tryoutId} - no questions found`,
      );
      return;
    }

    // used for mapping the total questions in set, will be used for weight calculation
    const questionsCountSets: { [setId: string]: number } = tryoutSetIds.reduce(
      (map, setId) => {
        map[setId] = 0; // the total questions
        return map;
      },
      {},
    );

    // used for mapping the question weights
    const questionsMap: { [questionId: string]: QuestionType } =
      questions.reduce((map, question) => {
        questionsCountSets[question.tryoutSetId]++; // increment the total questions in set

        // check type if its string
        if (typeof question.options === 'string') {
          question.options = JSON.parse(question.options);
        }

        map[question.id] = {
          id: question.id,
          tryoutSetId: question.tryoutSetId,
          isTextAnswer: question.isTextAnswer,
          correctScoreWeight: tryout.isIrt
            ? question.correctScoreWeight
            : tryout.correctBasePoint,
          wrongScoreWeight: tryout.isIrt
            ? question.wrongScoreWeight
            : tryout.wrongBasePoint,
          correctAnswersCount: 0,
          type: question.type,
          options: question.options,
          correctAnswers: question.correctFilledAnswers,
        } as QuestionType;

        return map;
      }, {});

    const questionAttempts = await this.db
      .selectDistinct({
        id: schema.tryout_question_attempts.id,
        userId: schema.tryout_question_attempts.userId,
        tryoutSetId: schema.tryout_question_attempts.tryoutSetId,
        questionId: schema.tryout_question_attempts.tryoutQuestionId,
        selectedOptionId: schema.tryout_question_attempts.optionId, // if MCQ
        filledAnswer: schema.tryout_question_attempts.filledAnswers, // if isian, table, or multiple answer
      })
      .from(schema.tryout_question_attempts)
      .innerJoin(
        schema.tryout_set_attempts,
        eq(
          schema.tryout_set_attempts.userId,
          schema.tryout_question_attempts.userId,
        ),
      )
      .where(
        and(
          eq(schema.tryout_question_attempts.tryoutId, tryoutId),
          inArray(
            schema.tryout_question_attempts.userId,
            tryoutAttempts.map(({ userId }) => userId),
          ),
        ),
      );

    // used for mapping the score for each question attempt
    const qAttemptsMap: { [qAttemptId: string]: QuestionAttemptType } =
      questionAttempts.reduce((map, attempt) => {
        if (!attempt.filledAnswer) {
          attempt.filledAnswer = [];
        }
        const question = questionsMap[attempt.questionId];
        const isCorrect = this.isAnswerCorrect(question, attempt);
        if (isCorrect) question.correctAnswersCount++;
        let score = 0;

        if (!tryout.isIrt) {
          score = isCorrect ? tryout.correctBasePoint : tryout.wrongBasePoint;
          userSetScores[attempt.userId][attempt.tryoutSetId] += score; // calculate set score on the fly
        }
        map[attempt.id] = {
          id: attempt.id,
          userId: attempt.userId,
          tryoutSetId: attempt.tryoutSetId,
          questionId: attempt.questionId,
          isCorrect,
          score, // if IRT, to be calculated later after question weight has been determined
        };

        return map;
      }, {});

    // If tryout is not IRT, then all question attempt scores has been calculated.
    // If tryout is IRT, then question weights are determined by the correct answers percentage.
    if (tryout.isIrt) {
      // determine question weights
      Object.keys(questionsMap).forEach((questionId) => {
        const question = questionsMap[questionId];
        const correctPercentage =
          question.correctAnswersCount / totalTryoutAttempts; // the smaller the value, the question difficulty increases

        const questionsCountInSet = questionsCountSets[question.tryoutSetId];
        // question weight algorithm
        if (correctPercentage < 0.1) {
          question.correctScoreWeight = 1000 / questionsCountInSet;
        } else if (correctPercentage < 0.25) {
          question.correctScoreWeight = 925 / questionsCountInSet;
        } else if (correctPercentage < 0.5) {
          question.correctScoreWeight = 850 / questionsCountInSet;
        } else if (correctPercentage < 0.75) {
          question.correctScoreWeight = 775 / questionsCountInSet;
        } else if (correctPercentage < 0.9) {
          question.correctScoreWeight = 700 / questionsCountInSet;
        } else {
          // 0.9 - 1
          question.correctScoreWeight = 625 / questionsCountInSet;
        }
      });

      Object.keys(qAttemptsMap).forEach((qAttemptId) => {
        const qAttempt = qAttemptsMap[qAttemptId];
        const question = questionsMap[qAttempt.questionId];
        // determine question attempt scores
        if (qAttempt.isCorrect) {
          qAttempt.score = question.correctScoreWeight;
        } else {
          qAttempt.score = question.wrongScoreWeight;
        }
        // determine set attempt scores
        userSetScores[qAttempt.userId][qAttempt.tryoutSetId] += qAttempt.score;
      });
    }

    // calculate tryout scores
    const userTryoutScores: { [key: string]: number } = Object.keys(
      userSetScores,
    ).reduce((map, userId) => {
      const setScores = userSetScores[userId];
      const totalSetScore = Object.values(setScores).reduce(
        (sum, setScore) => sum + setScore,
        0,
      );
      map[userId] = totalSetScore / tryoutSetIds.length; // average set scores
      return map;
    }, {});

    // Bulk update questions (correct and wrong weights)
    this.logger.log(
      `${dayjs().toISOString()}: calculate-tryout-score - Tryout ID: ${tryoutId} - updating question weights`,
    );
    const questionIds = Object.keys(questionsMap);
    const caseWhenCorrectScoreWeight = [];
    const caseWhenWrongScoreWeight = [];

    caseWhenCorrectScoreWeight.push(sql`(case`);
    caseWhenWrongScoreWeight.push(sql`(case`);

    questionIds.forEach((questionId) => {
      const question = questionsMap[questionId];
      caseWhenCorrectScoreWeight.push(
        sql`when id = ${questionId} then cast(${question.correctScoreWeight} as double precision)`,
      );
      caseWhenWrongScoreWeight.push(
        sql`when id = ${questionId} then cast(${question.wrongScoreWeight} as double precision)`,
      );
    });

    caseWhenCorrectScoreWeight.push(sql`end)`);
    caseWhenWrongScoreWeight.push(sql`end)`);

    const correctScoreWeightSql = sql.join(
      caseWhenCorrectScoreWeight,
      sql.raw(' '),
    );
    const wrongScoreWeightSql = sql.join(
      caseWhenWrongScoreWeight,
      sql.raw(' '),
    );

    await this.db
      .update(schema.tryout_questions)
      .set({
        correctScoreWeight: correctScoreWeightSql,
        wrongScoreWeight: wrongScoreWeightSql,
      })
      .where(inArray(schema.tryout_questions.id, questionIds));

    // Bulk update question attempts (scores)
    this.logger.log(
      `${dayjs().toISOString()}: calculate-tryout-score - Tryout ID: ${tryoutId} - updating question attempt scores`,
    );
    const qAttemptIds = Object.keys(qAttemptsMap);

    // make it as chunk
    const chunkSize = 500;
    for (let i = 0; i < qAttemptIds.length; i += chunkSize) {
      const chunk = qAttemptIds.slice(i, i + chunkSize);
      const insertValue = chunk.map((id) => {
        const qAttempt = qAttemptsMap[id];
        return sql`(${id}, ${qAttempt.score})`;
      });
      await this.db.execute(
        sql`CREATE TEMP TABLE TEMP_Q_SCORES (id uuid, score double precision);`,
      );
      await this.db.execute(
        sql`INSERT INTO TEMP_Q_SCORES (id, score) VALUES ${sql.join(
          insertValue,
          sql`, `,
        )}`,
      );
      await this.db.execute(
        sql`UPDATE ${schema.tryout_question_attempts} tqa SET score = ts.score FROM TEMP_Q_SCORES ts WHERE tqa.id = ts.id;`,
      );
      await this.db.execute(sql`DROP TABLE TEMP_Q_SCORES;`);
    }

    // Bulk update set attempts (scores)
    this.logger.log(
      `${dayjs().toISOString()}: calculate-tryout-score - Tryout ID: ${tryoutId} - updating set attempt scores`,
    );
    const userIds = Object.keys(userSetScores);

    // make it as chunk
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      const insertValue = chunk.map((userId) => {
        const setAttemptScores = userSetScores[userId];
        const setIdsThatUserAttempted = Object.keys(setAttemptScores);
        const setScores = Object.values(setAttemptScores);

        return setIdsThatUserAttempted.map((setId, index) => {
          return sql`(${setId}, ${userId}, ${setScores[index]})`;
        });
      });

      await this.db.execute(
        sql`CREATE TEMP TABLE TEMP_S_SCORES (tryout_set_id uuid, user_id uuid, score double precision);`,
      );
      await this.db.execute(
        sql`INSERT INTO TEMP_S_SCORES (tryout_set_id, user_id, score) VALUES ${sql.join(
          insertValue.flat(),
          sql`, `,
        )}`,
      );
      await this.db.execute(
        sql`UPDATE ${schema.tryout_set_attempts} tsa SET score = ts.score FROM TEMP_S_SCORES ts WHERE tsa.tryout_set_id = ts.tryout_set_id AND tsa.user_id = ts.user_id;`,
      );
      await this.db.execute(sql`DROP TABLE TEMP_S_SCORES;`);
    }

    // Bulk update tryout attempts (scores)
    this.logger.log(
      `${dayjs().toISOString()}: calculate-tryout-score - Tryout ID: ${tryoutId} - updating tryout attempt scores`,
    );

    // make it as chunk
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      const insertValue = chunk.map((userId) => {
        const tryoutScore = userTryoutScores[userId];
        return sql`(${userId}, ${tryoutScore})`;
      });
      await this.db.execute(
        sql`CREATE TEMP TABLE TEMP_T_SCORES (user_id uuid, score double precision);`,
      );
      await this.db.execute(
        sql`INSERT INTO TEMP_T_SCORES (user_id, score) VALUES ${sql.join(
          insertValue,
          sql`, `,
        )}`,
      );
      await this.db.execute(
        sql`UPDATE ${schema.tryout_attempts} ta SET score = ts.score FROM TEMP_T_SCORES ts WHERE ta.user_id = ts.user_id;`,
      );
      await this.db.execute(sql`DROP TABLE TEMP_T_SCORES;`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'calculate-tryout-scores',
    timeZone: 'Asia/Jakarta',
  })
  async calculateAllTryoutScores() {
    const tryouts = await this.db.query.tryouts.findMany({
      columns: {
        id: true,
      },
    });
    for (let i = 0; i < tryouts.length; i++) {
      const tryout = tryouts[i];
      try {
        this.logger.log(
          `${dayjs().toISOString()}: calculate-tryout-score - Tryout ID: ${
            tryout.id
          } - start`,
        );
        await this.calculateUsersTryoutScores(tryout.id);
        this.logger.log(
          `${dayjs().toISOString()}: calculate-tryout-score - Tryout ID: ${
            tryout.id
          } - finished`,
        );
      } catch (err) {
        this.logger.error(
          `${dayjs().toISOString()}: calculate-tryout-score - Tryout ID: ${
            tryout.id
          } - ERROR: ${err.message}`,
        );
        this.logger.error(err.stack);
      }
    }
  }

  isAnswerCorrect(question: QuestionType, attempt: any): boolean {
    let isCorrect = false;
    if (question.type == TryoutTypeEnum.MULTIPLE_CHOICE) {
      const selectedOptionId = attempt.selectedOptionId;
      isCorrect = question.options.find(
        (option) => option.id === selectedOptionId,
      )?.is_true;
    } else if (question.type == TryoutTypeEnum.FILL_IN) {
      isCorrect =
        JSON.stringify(attempt.filledAnswer) ===
        JSON.stringify(question.correctAnswers);
    } else if (question.type == TryoutTypeEnum.MULTIPLE_ANSWER) {
      const correctedOptionsId = question.options
        .filter((option) => option.is_true)
        .map((option) => option.id);
      correctedOptionsId.sort();
      const filledAnswers = attempt.filledAnswer
        ?.map((answer) => answer)
        .sort();
      isCorrect =
        JSON.stringify(correctedOptionsId) === JSON.stringify(filledAnswers);
    } else if (question.type == TryoutTypeEnum.TABLE_CHOICE) {
      isCorrect = true;
      for (let i = 0; i < question.options.length; i++) {
        if (question.options[i].is_true && attempt.filledAnswer[i] != 'TRUE') {
          isCorrect = false;
          break;
        } else if (
          !question.options[i].is_true &&
          attempt.filledAnswer[i] != 'FALSE'
        ) {
          isCorrect = false;
          break;
        }
      }
    }
    return isCorrect;
  }
}

export default TryoutWorkerService;
