import {
  BadRequestException,
  CACHE_MANAGER,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PointHistory } from '../../database/firebase/firebase.model';
import { FirebaseService } from '../../database/firebase/firebase.service';
import { Cache } from 'cache-manager';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { OnboardingDto, UpdateUserProfileDto } from './users.dto';
import * as schema from '../../database/schema';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { DrizzleAsyncProvider } from '../../database/drizzle/drizzle.provider';
import * as dayjs from 'dayjs';
import { generateRandomString } from '../../common/lib/utils';
import { S3Service } from '../../s3/s3.service';
import { v4 } from 'uuid';
import * as bcrypt from 'bcrypt';

@Injectable()
export default class UsersService {
  constructor(
    private readonly firebaseService: FirebaseService,
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @InjectRedis() private readonly redis: Redis,
    private s3Service: S3Service,
  ) {}

  async getMyPoints(userId: string) {
    const userPoint: number = await this.cacheManager.get(`point:${userId}`);
    if (userPoint) {
      return {
        totalPoints: userPoint,
        rank: (await this.redis.zrevrank('leaderboard', userId)) + 1,
      };
    }

    const fDb = this.firebaseService.getDb();
    const pointHistoryRef = fDb.collection('point_history').doc(userId);
    const doc = await pointHistoryRef.get();

    if (!doc.exists) {
      return {
        totalPoints: 0,
        rank: (await this.redis.zrevrank('leaderboard', userId)) + 1,
      };
    } else {
      const pointHistory = doc.data() as {
        history: PointHistory[];
      };

      const totalPoints = pointHistory.history.reduce((acc, curr) => {
        return acc + curr.point;
      }, 0);

      await this.cacheManager.set(`point:${userId}`, totalPoints, 24 * 60 * 60);

      await this.redis.zadd('leaderboard', totalPoints, userId);

      return {
        totalPoints,
        rank: (await this.redis.zrevrank('leaderboard', userId)) + 1,
      };
    }
  }

  async addPoint(userId: string, point: number, activity: string) {
    const fDb = this.firebaseService.getDb();
    const pointHistoryRef = fDb.collection('point_history').doc(userId);
    const doc = await pointHistoryRef.get();

    if (!doc.exists) {
      await pointHistoryRef.set({
        history: [
          {
            acitivity: activity,
            point,
            timestamp: new Date(),
          },
        ],
      });
    } else {
      const pointHistory = doc.data() as {
        history: PointHistory[];
      };

      await pointHistoryRef.update({
        history: [
          ...pointHistory.history,
          {
            point,
            timestamp: new Date(),
          },
        ],
      });
    }

    const newPoint = (await this.getMyPoints(userId)).totalPoints;

    await this.cacheManager.set(`point:${userId}`, newPoint, 24 * 60 * 60);

    await this.redis.zadd('leaderboard', newPoint, userId);

    return newPoint;
  }

  async onboarding(userId: string, data: OnboardingDto) {
    const user = await this.db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate phone number format +62
    if (data.phone_number) {
      if (!data.phone_number.startsWith('+62')) {
        throw new BadRequestException('Nomor telepon harus dimulai dengan +62');
      }
      if (data.phone_number.length < 12 || data.phone_number.length > 15) {
        throw new BadRequestException(
          'Format nomor telepon tidak valid. Harus +62 diikuti 9-12 digit',
        );
      }
      // Validate format: +62XXXXXXXXXXX (9-12 digits after +62)
      const phoneRegex = /^\+62\d{9,12}$/;
      if (!phoneRegex.test(data.phone_number)) {
        throw new BadRequestException(
          'Format nomor telepon tidak valid. Contoh: +6281234567890',
        );
      }
    }

    const checkIsPhoneNumberExist = await this.db.query.users.findFirst({
      where: (users, { eq }) => eq(users.phone_number, data.phone_number),
    });

    if (checkIsPhoneNumberExist && checkIsPhoneNumberExist.id !== userId) {
      throw new ConflictException('Nomor whatsapp sudah terdaftar');
    }

    if (user.onboard_date) {
      return {
        phone_number: user.phone_number,
        full_name: user.full_name,
        highschool: user.highschool,
        highschool_year: user.highschool_year,
        choosen_university_one: user.choosen_university_one,
        choosen_major_one: user.choosen_major_one,
        choosen_university_two: user.choosen_university_two,
        choosen_major_two: user.choosen_major_two,
        choosen_university_three: user.choosen_university_three,
        choosen_major_three: user.choosen_major_three,
        referral_code: user.referral_code,
        source: user.source,
        onboard_date: user.onboard_date,
        email: user.email,
        register_referal_code: user.referral_code ?? null,
      };
    }

    let referalCode = '';

    referalCode = generateRandomString(6);

    const newUser = await this.db
      .update(schema.users)
      .set({
        full_name: data.full_name,
        highschool: data.highschool,
        highschool_year: data.highschool_year,
        choosen_university_one: data.choosen_university_one,
        choosen_major_one: data.choosen_major_one,
        choosen_university_two: data.choosen_university_two,
        choosen_major_two: data.choosen_major_two,
        choosen_university_three: data.choosen_university_three,
        choosen_major_three: data.choosen_major_three,
        referral_code: referalCode,
        source: data.source,
        onboard_date: new Date(),
        email: data.email,
        register_referal_code: data.referral_code ?? null,
        phone_number: data.phone_number,
      })
      .where(eq(schema.users.id, userId))
      .returning()
      .execute();

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      const password = await bcrypt.hash(data.password, salt);

      await this.db
        .update(schema.users)
        .set({
          password,
        })
        .where(eq(schema.users.id, userId))
        .execute();
    }

    // add to leaderboard
    await this.redis.zadd('leaderboard', 0, userId);

    const fDb = this.firebaseService.getDb();
    const pointHistoryRef = fDb.collection('point_history').doc(userId);

    await pointHistoryRef.set({
      history: [
        {
          activity: 'onboarding',
          point: 0,
          timestamp: new Date(),
        },
      ],
    });

    const savedCatatanRef = fDb.collection('saved_catatan').doc(userId);

    await savedCatatanRef.set({
      catatan_ids: [],
    });

    const likedCatatanHistoryRef = fDb
      .collection('liked_catatan_history')
      .doc(userId);

    const likedCatatanRef = fDb.collection('liked_catatan').doc(userId);

    await likedCatatanHistoryRef.set({
      histories: [],
    });

    await likedCatatanRef.set({
      catatan_ids: [],
    });

    return {
      email: newUser[0].email,
      full_name: newUser[0].full_name,
      highschool: newUser[0].highschool,
      highschool_year: newUser[0].highschool_year,
      choosen_university_one: newUser[0].choosen_university_one,
      choosen_major_one: newUser[0].choosen_major_one,
      choosen_university_two: newUser[0].choosen_university_two,
      choosen_major_two: newUser[0].choosen_major_two,
      choosen_university_three: newUser[0].choosen_university_three,
      choosen_major_three: newUser[0].choosen_major_three,
      phone_number: newUser[0].phone_number,
      onboard_date: newUser[0].onboard_date,
    };
  }

  async isOnboarded(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.onboard_date) {
      return true;
    }

    return false;
  }

  async getUserProfile(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const subscribedPlan = await this.db
      .select()
      .from(schema.transactions)
      .orderBy(desc(schema.transactions.timestamp))
      .limit(1)
      .leftJoin(
        schema.transactionOrders,
        eq(schema.transactionOrders.id, schema.transactions.order_id),
      )
      .where(
        and(
          eq(schema.transactions.user_id, userId),
          isNotNull(schema.transactionOrders.id),
        ),
      )
      .execute();

    delete user.password;
    delete user.register_referal_code;

    const res = {
      ...user,
      validity_date: dayjs(user.validity_date).format('DD-MM-YYYY'),
    };

    return {
      user: res,
      package_plan: subscribedPlan[0] ?? null,
    };
  }

  async updateUserProfile(userId: string, data: Partial<UpdateUserProfileDto>) {
    const user = await this.db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, userId),
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const result = await this.db
      .update(schema.users)
      .set({
        full_name: data.full_name ?? user.full_name,
        highschool: data.highschool ?? user.highschool,
        phone_number: data.phone_number ?? user.phone_number,
        profile_img: data.profile_img ?? user.profile_img,
        choosen_major_one: data.choosen_major_one ?? user.choosen_major_one,
        highschool_year: data.highschool_year ?? user.highschool_year,
        choosen_university_two:
          data.choosen_university_two ?? user.choosen_university_two,
        choosen_major_two: data.choosen_major_two ?? user.choosen_major_two,
        choosen_university_three:
          data.choosen_university_three ?? user.choosen_university_three,
        choosen_major_three:
          data.choosen_major_three ?? user.choosen_major_three,
        email: data.email ?? user.email,
        choosen_university_one:
          data.choosen_university_one ?? user.choosen_university_one,
      })
      .where(eq(schema.users.id, userId))
      .returning()
      .execute();

    return result[0];
  }

  async registerTryout(
    userId: string,
    tryoutId: string,
    submissions: { first: string; second: string; third: string },
  ) {
    const registerQuery = await this.db.query.tryout_registrations.findFirst({
      where: and(
        eq(schema.tryout_registrations.user_id, userId),
        eq(schema.tryout_registrations.tryout_id, tryoutId),
      ),
    });
    if (
      (await this.isSubscribed(userId)) === false &&
      (submissions.first === null ||
        submissions.second === null ||
        submissions.third === null)
    ) {
      throw new ConflictException('User not subscribed');
    }

    const values = {
      user_id: userId,
      tryout_id: tryoutId,
      first_task_submission: submissions.first,
      second_task_submission: submissions.second,
      third_task_submission: submissions.third,
    };

    const result = await this.db
      .insert(schema.tryout_registrations)
      .values(values)
      .onConflictDoNothing()
      .returning()
      .execute();

    return result[0];
  }

  async isSubscribed(userId: string) {
    const user = await this.db.query.users.findFirst({
      where: ({ id }, { eq }) => eq(id, userId),
      columns: {
        validity_date: true,
      },
    });

    const isUserSubscribed = dayjs(user.validity_date).isAfter(dayjs());

    return isUserSubscribed;
  }

  async uploadTryoutSubmission(userId: string, file: Express.Multer.File) {
    const generatedId = v4();
    const fileExtension = file.originalname.split('.').pop();
    const filePath = `tryout-submission/${userId}-${generatedId}.${fileExtension}`;
    const result = await this.s3Service.uploadFile(file, filePath);
    return result;
  }

  async getTryoutRegistration(userId: string, tryoutId: string) {
    const registeredTO = await this.db.query.tryout_registrations.findMany({
      where: and(eq(schema.tryout_registrations.user_id, userId)),
    });

    // check if user already registered
    const result = registeredTO.find((item) => item.tryout_id === tryoutId);

    const isUserEligable = await this.isSubscribed(userId);

    if (!result) {
      return {
        created_at: null,
        validated: null,
        is_eligable: isUserEligable,
      };
    }

    const isValidated = dayjs(result.created_at)
      .add(5, 'minutes')
      .isBefore(dayjs());
    return {
      created_at: result.created_at,
      validated: isUserEligable ? true : isValidated,
    };
  }
}
