import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DrizzleAsyncProvider } from 'src/database/drizzle/drizzle.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from 'src/database/schema';
import { and, desc, eq, inArray, lte, ne } from 'drizzle-orm';
import * as dayjs from 'dayjs';

@Injectable()
class TryoutLeaderboardService {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
  ) {}

  async getLeaderboard(tryoutId: string) {
    const tryout = await this.db.query.tryouts.findFirst({
      where: (tryout, { eq }) => eq(tryout.id, tryoutId),
    });
    if (!tryout) {
      console.log(
        `${new Date().toISOString()}: Tryout not found with id '${tryoutId}'`,
      );
      throw new NotFoundException(`Tryout not found with id '${tryoutId}'`);
    }

    const tryoutAttempts = await this.db
      .select({
        id: schema.tryout_attempts.id,
        score: schema.tryout_attempts.score,
        userId: schema.tryout_attempts.userId,
      })
      .from(schema.tryout_attempts)
      .where(eq(schema.tryout_attempts.tryoutId, tryoutId))
      .orderBy(desc(schema.tryout_attempts.score))
      .limit(100);

    if (!tryoutAttempts.length) return [];

    const userIds = tryoutAttempts.map(({ userId }) => userId);

    const users = await this.db
      .select({
        id: schema.users.id,
        full_name: schema.users.full_name,
        first_university: schema.users.choosen_university_one,
        first_major: schema.users.choosen_major_one,
        second_university: schema.users.choosen_university_two,
        second_major: schema.users.choosen_major_two,
        third_university: schema.users.choosen_university_three,
        third_major: schema.users.choosen_major_three,
        highschool: schema.users.highschool,
        profile_img: schema.users.profile_img,
      })
      .from(schema.users)
      .where(inArray(schema.users.id, userIds));

    const userMap = {};

    users.forEach((user) => {
      userMap[user.id] = {
        ...user,
        subject_scores: {},
      };
    });

    const userSubjectScores = await this.db
      .selectDistinct({
        user_id: schema.users.id,
        subject_name: schema.tryout_subjects.name,
        score: schema.tryout_set_attempts.score,
      })
      .from(schema.users)
      .where(inArray(schema.users.id, userIds))
      .innerJoin(
        schema.tryout_set_attempts,
        eq(schema.tryout_set_attempts.userId, schema.users.id),
      )
      .innerJoin(
        schema.tryout_sets,
        and(
          eq(schema.tryout_sets.id, schema.tryout_set_attempts.tryoutSetId),
          eq(schema.tryout_sets.tryoutId, tryoutId),
        ),
      )
      .innerJoin(
        schema.tryout_subjects,
        eq(schema.tryout_subjects.id, schema.tryout_sets.subjectId),
      );

    userSubjectScores.forEach((e) => {
      userMap[e.user_id]['subject_scores'][e.subject_name] = e.score;
    });

    const result = tryoutAttempts.map((attempt, index) => {
      return {
        user: userMap[attempt.userId], // already consist of uni and major options, and scores for each set
        tryout_score: Math.floor(attempt.score),
        rank: index + 1,
      };
    });

    return result;
  }

  async getMyRank(tryoutId: string, userId: string) {
    const tryout = await this.db.query.tryouts.findFirst({
      where: (tryout, { eq }) => eq(tryout.id, tryoutId),
    });
    if (!tryout) {
      console.log(
        `${new Date().toISOString()}: Tryout not found with id '${tryoutId}'`,
      );
      throw new NotFoundException(`Tryout not found with id '${tryoutId}'`);
    }

    const tryoutAttempts = await this.db
      .select({
        id: schema.tryout_attempts.id,
        userId: schema.tryout_attempts.userId,
        score: schema.tryout_attempts.score,
        ptnOne: schema.users.choosen_university_one,
        majorOne: schema.users.choosen_major_one,
        ptnTwo: schema.users.choosen_university_two,
        majorTwo: schema.users.choosen_major_two,
        ptnThree: schema.users.choosen_university_three,
        majorThree: schema.users.choosen_major_three,
      })
      .from(schema.tryout_attempts)
      .where(eq(schema.tryout_attempts.tryoutId, tryoutId))
      .innerJoin(
        schema.users,
        eq(schema.users.id, schema.tryout_attempts.userId),
      )
      .orderBy(desc(schema.tryout_attempts.score));

    if (!tryoutAttempts.length)
      throw new BadRequestException(`You haven't attempt this tryout`);
    const myAttempt = tryoutAttempts.find(
      (attempt) => attempt.userId == userId,
    );
    if (!myAttempt)
      throw new BadRequestException(`You haven't attempt this tryout`);

    const averageScore = myAttempt.score; // average scores of set is equal to tryout score

    const ranks: {
      ptn: string;
      major: string;
      total_users: number;
      is_found: boolean;
      rank: number;
    }[] = []; // ranks in selected ptn and major options
    if (myAttempt.ptnOne && myAttempt.majorOne) {
      ranks.push({
        ptn: myAttempt.ptnOne,
        major: myAttempt.majorOne,
        total_users: 0,
        is_found: false,
        rank: 0,
      });
    }
    if (myAttempt.ptnTwo && myAttempt.majorTwo) {
      ranks.push({
        ptn: myAttempt.ptnTwo,
        major: myAttempt.majorTwo,
        total_users: 0,
        is_found: false,
        rank: 0,
      });
    }
    if (myAttempt.ptnThree && myAttempt.majorThree) {
      ranks.push({
        ptn: myAttempt.ptnThree,
        major: myAttempt.majorThree,
        total_users: 0,
        is_found: false,
        rank: 0,
      });
    }

    const totalUsersThatHaveTriedTO: number = tryoutAttempts.length;

    let overallRank = 0;

    tryoutAttempts.forEach((attempt, index) => {
      if (attempt.userId == userId) overallRank = index + 1;

      ranks.forEach((rankInPtn) => {
        const isSamePtnOption =
          (attempt.majorOne == rankInPtn.major &&
            attempt.ptnOne == rankInPtn.ptn) ||
          (attempt.majorTwo == rankInPtn.major &&
            attempt.ptnTwo == rankInPtn.ptn) ||
          (attempt.majorThree == rankInPtn.major &&
            attempt.ptnThree == rankInPtn.ptn);

        if (isSamePtnOption) {
          rankInPtn.total_users++;
          if (!rankInPtn.is_found) {
            rankInPtn.rank++;
            rankInPtn.is_found = attempt.userId == userId; // rank in selected ptn and major has been determined, no need to increment again
          }
        }
      });
    });

    const positionPercentage = (overallRank / totalUsersThatHaveTriedTO) * 100;

    const formattedRanks = ranks.map((rankInPtn) => {
      return {
        ptn: rankInPtn.ptn,
        major: rankInPtn.major,
        total_users: rankInPtn.total_users,
        rank: rankInPtn.rank,
        percentage: ((rankInPtn.rank / rankInPtn.total_users) * 100).toFixed(2),
      };
    });

    const tryoutSetScores = await this.db
      .select({
        subject_name: schema.tryout_subjects.name,
        id: schema.tryout_set_attempts.id,
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

    const setScoresMap = tryoutSetScores.reduce((map, setScore) => {
      map[setScore.subject_name] = setScore;
      return map;
    }, {});

    const otherTryoutAttempts = await this.db
      .select({
        id: schema.tryout_attempts.id,
        score: schema.tryout_attempts.score,
      })
      .from(schema.tryout_attempts)
      .where(
        and(
          eq(schema.tryout_attempts.userId, userId),
          ne(schema.tryout_attempts.tryoutId, tryoutId), // except the current tryout
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

    let prevAvgTOScore = null;
    let avgTOScoreIncrease = null;

    if (otherTryoutAttempts.length) {
      const sumTOScores = otherTryoutAttempts.reduce(
        (sum, tryout) => sum + tryout.score,
        0,
      );
      prevAvgTOScore = sumTOScores / otherTryoutAttempts.length;
      prevAvgTOScore = Math.floor(prevAvgTOScore);

      const scoreDiff = averageScore - prevAvgTOScore;
      avgTOScoreIncrease = ((scoreDiff / prevAvgTOScore) * 100).toFixed(2); // can have negative value if the current tryout score is less than the prev avg TO score
    }

    return {
      tryout_id: tryoutId,
      tryout_name: tryout.name,
      overall_rank: {
        rank: overallRank,
        total_users: totalUsersThatHaveTriedTO,
        percentage: positionPercentage.toFixed(2),
      },
      rank_in_choices: formattedRanks,
      tryout_score: Math.floor(averageScore), // avg set scores
      set_scores: setScoresMap,
      previous_avg_tryout_score: prevAvgTOScore,
      avg_tryout_score_increase: avgTOScoreIncrease, // in percentage
    };
  }
}

export default TryoutLeaderboardService;
