import { PointHistory } from '../../database/firebase/firebase.model';
import { CACHE_MANAGER, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { FirebaseService } from '../../database/firebase/firebase.service';
import * as schema from '../../database/schema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, eq, gt, or, sql } from 'drizzle-orm';
import { DrizzleAsyncProvider } from '../../database/drizzle/drizzle.provider';

@Injectable()
export default class AcademicStatisticService {
  constructor(
    private readonly firebaseService: FirebaseService,
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getAvgEarnedPoints(year?: number, ptn?: string) {
    const avgEarnedPoints = await this.cacheManager.get(
      `avgEarnedPoints:${year}:${ptn}`,
    );
    if (avgEarnedPoints) {
      return avgEarnedPoints;
    }

    const fDb = this.firebaseService.getDb();
    const pointHistory = await fDb.collection('point_history').get();
    const docs = pointHistory.docs;

    let totalPoints = 0;
    let totalUsers = 0;

    docs.forEach((doc) => {
      const data = doc.data();
      let userPoints = 0;
      data.history.forEach((d: PointHistory) => {
        userPoints += d.point;
      });
      if (userPoints > 0) {
        totalPoints += userPoints;
        totalUsers++;
      }
    });

    const result = Math.round(totalPoints / totalUsers);
    await this.cacheManager.set(
      `avgEarnedPoints:${year}:${ptn}`,
      result,
      60 * 60 * 24,
    );

    return result;
  }

  async getAvgCorrectAnswer(year?: number, ptn?: string) {
    const avgCorrectAnswer = await this.cacheManager.get(
      `avgCorrectAnswer:${year}:${ptn}`,
    );
    if (avgCorrectAnswer) {
      return avgCorrectAnswer;
    }

    const answers = await this.db
      .select({
        user: schema.users.id,
        options: schema.options.options,
        choice: schema.question_attempts.choice_id,
      })
      .from(schema.question_attempts)
      // .leftJoin(schema.options, eq(schema.question_attempts.options_id, schema.options.id))
      .leftJoin(
        schema.users,
        eq(schema.question_attempts.user_id, schema.users.id),
      )
      .where(
        and(
          !!year
            ? sql`extract(year from question_attempts.submitted_time) = ${year}`
            : undefined,
          !!ptn
            ? or(
                eq(schema.users.choosen_university_one, ptn),
                eq(schema.users.choosen_university_two, ptn),
                eq(schema.users.choosen_university_three, ptn),
              )
            : undefined,
        ),
      );

    const correctCount = 0;
    const uniqueUsers = new Set();
    answers.forEach((answer) => {
      const options = answer.options;
      const choice = answer.choice;

      // const choosenOption = options.find((option) => option.id === choice);

      // if (choosenOption.is_true) {
      //   correctCount++;
      // }

      if (!uniqueUsers.has(answer.user)) {
        uniqueUsers.add(answer.user);
      }
    });

    const result = Math.round(correctCount / uniqueUsers.size);
    await this.cacheManager.set(
      `avgCorrectAnswer:${year}:${ptn}`,
      result,
      60 * 60 * 12,
    );

    return result;
  }

  async getAvgIncorrectAnswer(year?: number, ptn?: string) {
    const avgIncorrectAnswer = await this.cacheManager.get(
      `avgIncorrectAnswer:${year}:${ptn}`,
    );
    if (avgIncorrectAnswer) {
      return avgIncorrectAnswer;
    }

    const answers = await this.db
      .select({
        user: schema.users.id,
        options: schema.options.options,
        choice: schema.question_attempts.choice_id,
      })
      .from(schema.question_attempts)
      // .leftJoin(schema.options, eq(schema.question_attempts.options_id, schema.options.id))
      .leftJoin(
        schema.users,
        eq(schema.question_attempts.user_id, schema.users.id),
      )
      .where(
        and(
          !!year
            ? sql`extract(year from question_attempts.submitted_time) = ${year}`
            : undefined,
          !!ptn
            ? or(
                eq(schema.users.choosen_university_one, ptn),
                eq(schema.users.choosen_university_two, ptn),
                eq(schema.users.choosen_university_three, ptn),
              )
            : undefined,
        ),
      );

    const incorrectCount = 0;
    const uniqueUsers = new Set();
    answers.forEach((answer) => {
      const options = answer.options;
      const choice = answer.choice;

      // const choosenOption = options.find((option) => option.id === choice);

      // if (!choosenOption.is_true) {
      //   incorrectCount++;
      // }

      if (!uniqueUsers.has(answer.user)) {
        uniqueUsers.add(answer.user);
      }
    });

    const result = Math.round(incorrectCount / uniqueUsers.size);
    await this.cacheManager.set(
      `avgIncorrectAnswer:${year}:${ptn}`,
      result,
      60 * 60 * 12,
    );

    return incorrectCount;
  }

  async getUserRegisteredCount(year?: number, ptn?: string) {
    const result = await this.db
      .select({
        count: sql`count(*)`,
      })
      .from(schema.users)
      .where(
        and(
          !!year ? sql`extract(year from onboard_date) = ${year}` : undefined,
          !!ptn
            ? or(
                eq(schema.users.choosen_university_one, ptn),
                eq(schema.users.choosen_university_two, ptn),
                eq(schema.users.choosen_university_three, ptn),
              )
            : undefined,
        ),
      );
    return Number(result[0].count);
  }

  async getAnsweredQuestion(year?: number, ptn?: string) {
    const result = await this.db
      .select({
        questionId: schema.questions.id,
        attemptCount: sql`count(${schema.question_attempts.id})`,
      })
      .from(schema.questions)
      .leftJoin(
        schema.question_attempts,
        eq(schema.questions.id, schema.question_attempts.question_id),
      )
      .leftJoin(
        schema.users,
        eq(schema.question_attempts.user_id, schema.users.id),
      )
      .where(
        and(
          !!year
            ? sql`extract(year from question_attempts.submitted_time) = ${year}`
            : undefined,
          !!ptn
            ? or(
                eq(schema.users.choosen_university_one, ptn),
                eq(schema.users.choosen_university_two, ptn),
                eq(schema.users.choosen_university_three, ptn),
              )
            : undefined,
        ),
      )
      .groupBy(schema.questions.id)
      .having(gt(sql`count(${schema.question_attempts.id})`, 0));

    return result.length;
  }

  async getUnansweredQuestion(year?: number, ptn?: string) {
    const result = await this.db
      .select({
        questionId: schema.questions.id,
        attemptCount: sql`count(${schema.question_attempts.id})`,
      })
      .from(schema.questions)
      .leftJoin(
        schema.question_attempts,
        eq(schema.questions.id, schema.question_attempts.question_id),
      )
      .leftJoin(
        schema.users,
        eq(schema.question_attempts.user_id, schema.users.id),
      )
      .where(
        and(
          !!year
            ? sql`extract(year from question_attempts.submitted_time) = ${year}`
            : undefined,
          !!ptn
            ? or(
                eq(schema.users.choosen_university_one, ptn),
                eq(schema.users.choosen_university_two, ptn),
                eq(schema.users.choosen_university_three, ptn),
              )
            : undefined,
        ),
      )
      .groupBy(schema.questions.id)
      .having(eq(sql`count(${schema.question_attempts.id})`, 0));

    return result.length;
  }
}
