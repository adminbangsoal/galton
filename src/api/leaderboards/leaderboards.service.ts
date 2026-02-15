import { Inject, Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import { S3Service } from '../../s3/s3.service';
import { DrizzleAsyncProvider } from '../../database/drizzle/drizzle.provider';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../database/schema';
import { desc, inArray } from 'drizzle-orm';
import axios from 'axios';
import UsersService from '../users/users.service';

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly s3Service: S3Service,
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
    private userService: UsersService,
  ) {}

  async getLeaderboard() {
    const leaderboard = await this.redis.zrevrange(
      'leaderboard',
      0,
      100,
      'WITHSCORES',
    );

    const result = [];

    const userIds = [];

    if (leaderboard.length == 0) {
      const latestLeaderboard = await this.db
        .select()
        .from(schema.leaderboard_backup)
        .orderBy(desc(schema.leaderboard_backup.timestamp))
        .limit(1);

      if (latestLeaderboard.length == 0) {
        return [];
      }

      const key = latestLeaderboard[0].timestamp;

      const signedUrl = await this.s3Service.getPresignedUrl(
        `leaderboard/${key}.json`,
      );

      const { data } = await axios.get(signedUrl);

      for (let i = 0; i < data.length; i++) {
        await this.redis.zadd(
          'leaderboard',
          data[i].totalPoints,
          data[i].userId,
        );

        leaderboard.push(data[i].userId);
        leaderboard.push(data[i].totalPoints);
      }
    }

    for (let i = 0; i < leaderboard.length; i += 2) {
      userIds.push(leaderboard[i]);
    }

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
      userMap[user.id] = user;
    });

    for (let i = 0; i < leaderboard.length; i += 2) {
      result.push({
        user: userMap[leaderboard[i]],
        totalPoints: parseInt(leaderboard[i + 1], 10),
        rank: (await this.redis.zrevrank('leaderboard', leaderboard[i])) + 1,
      });
    }
    return result;
  }

  async getMyRank(userId: string) {
    const point = await this.redis.zscore('leaderboard', userId);

    return {
      rank: (await this.redis.zrevrank('leaderboard', userId)) + 1,
      point: parseInt(point, 10),
    };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'clear-non-exist-leaderboard',
    timeZone: 'Asia/Jakarta',
  })
  async clearNonExistUserLeaderboard() {
    const leaderboard = await this.redis.zrevrange(
      'leaderboard',
      0,
      -1,
      'WITHSCORES',
    );

    const usersId = [];
    for (let i = 0; i < leaderboard.length; i += 2) {
      usersId.push(leaderboard[i]);
    }
    // https://stackoverflow.com/questions/1009706/postgresql-max-number-of-parameters-in-in-clause
    const maxIn = 32767;

    const chunkedLeaderboard = [];

    for (let i = 0; i < usersId.length; i += maxIn) {
      chunkedLeaderboard.push(usersId.slice(i, i + maxIn));
    }

    for (let i = 0; i < chunkedLeaderboard.length; i++) {
      const users = await this.db.query.users.findMany({
        where: (users, { inArray }) => inArray(users.id, chunkedLeaderboard[i]),
      });

      const usersId = users.map((user) => user.id);

      const nonExistUsers = chunkedLeaderboard[i].filter(
        (id) => !usersId.includes(id),
      );

      if (nonExistUsers.length > 0) {
        await this.redis.zrem('leaderboard', ...nonExistUsers);
      }
    }

    return;
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'backup-leaderboard',
    timeZone: 'Asia/Jakarta',
  })
  async backupLeaderboard() {
    const leaderboard = await this.redis.zrevrange(
      'leaderboard',
      0,
      -1,
      'WITHSCORES',
    );
    const result = [];
    let k = 0;
    for (let i = 0; i < leaderboard.length; i += 2) {
      const point = parseInt(leaderboard[i + 1], 10);
      result.push({
        userId: leaderboard[i],
        totalPoints: point,
        rank: k + 1,
      });
      k++;
    }

    const buffer = Buffer.from(JSON.stringify(result));

    const date = new Date().toISOString();

    const { url } = await this.s3Service.uploadFile(
      buffer,
      `leaderboard/${date}.json`,
      'bangsoal',
    );

    await this.db.insert(schema.leaderboard_backup).values({
      timestamp: date,
      url,
    });

    const signedUrl = this.s3Service.getPresignedUrl(
      `leaderboard/${date}.json`,
    );
    return signedUrl;
  }

  async getPtnRank() {
    const usersArray = [];

    const leaderboard = await this.redis.zrevrange('leaderboard', 0, 20);

    const users = await this.db
      .select({
        id: schema.users.id,
        ptn: schema.users.choosen_university_one,
        major: schema.users.choosen_major_one,
      })
      .from(schema.users)
      .where(inArray(schema.users.id, leaderboard))
      .limit(20)
      .execute();

    const ptnMap = {};

    for (let i = 0; i < users.length; i++) {
      if (Object.keys(ptnMap).length == 3) {
        break;
      }

      if (ptnMap[users[i].major] == undefined) {
        ptnMap[users[i].major] = true;
      } else {
        continue;
      }

      usersArray.push({
        user: users[i],
        point: await this.userService.getMyPoints(users[i].id),
      });
    }

    // sort by point
    usersArray.sort((a, b) => {
      return b.point - a.point;
    });

    const result = [];

    usersArray.forEach((user) => {
      result.push({
        ptn: user.user.ptn,
        major: user.user.major,
      });
    });

    return result;
  }
}
