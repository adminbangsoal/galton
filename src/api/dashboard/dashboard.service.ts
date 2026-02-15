import { Inject, Injectable, Logger } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DrizzleAsyncProvider } from '../../database/drizzle/drizzle.provider';
import * as schema from '../../database/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import * as dayjs from 'dayjs';
import UsersService from '../users/users.service';
import { S3Service } from '../../s3/s3.service';
import 'dayjs/locale/id';
import { capitalizeFirstLetter } from '../../common/lib/utils';
import LatihanSoalService from '../latihan-soal/latihan-soal.service';
import { Question } from '../../database/schema';

@Injectable()
export class DashboardService {
  readonly logger = new Logger(DashboardService.name);
  constructor(
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
    private userService: UsersService,
    private s3Service: S3Service,
    private latihanSoalService: LatihanSoalService,
  ) {}

  async getDashboardHeaders(userId: string) {
    const streakDays = await this.db
      .select()
      .from(schema.question_attempts)
      .orderBy(desc(schema.question_attempts.timestamp))
      .where(eq(schema.question_attempts.user_id, userId))
      .execute();

    let today = dayjs();
    let streak = 0;

    for (let i = 0; i < streakDays.length; i++) {
      if (i == 0) {
        if (today.diff(streakDays[i].timestamp, 'day') > 1) {
          break;
        } else {
          streak++;
        }
      }

      const streakDay = streakDays[i];
      const timestamp = dayjs(streakDay.timestamp);
      const diff = Math.round(today.diff(timestamp, 'hours') / 24);

      if (diff > 1) {
        break;
      }

      if (diff == 0) {
        continue;
      }

      if (diff == 1) {
        today = today.subtract(1, 'day');
        streak++;
      }
    }

    const attemptedQuestionsDistinct = await this.db
      .selectDistinctOn([schema.question_attempts.question_id], {
        id: schema.question_attempts.id,
        choiceId: schema.question_attempts.choice_id,
        filledAnswers: schema.question_attempts.filledAnswers,
        questionId: schema.question_attempts.question_id,
      })
      .from(schema.question_attempts)
      .orderBy(
        schema.question_attempts.question_id,
        desc(schema.question_attempts.timestamp),
      )
      .where(eq(schema.question_attempts.user_id, userId))
      .execute();

    const attemptIds = attemptedQuestionsDistinct.map(({ id }) => id);

    const totalQuestions = await this.db
      .select({
        value: sql`count(id)`.mapWith(Number),
      })
      .from(schema.questions);

    const totalQuestionsCount = totalQuestions[0].value;

    if (attemptIds.length === 0) {
      return {
        finished: {
          done: 0,
          total: totalQuestionsCount,
        },
        accuracy: {
          percentage: 0,
          correct_answers: 0,
          total_attempted_question: 0,
        },
      };
    }

    const totalAttemptedQuestions = attemptedQuestionsDistinct.length;

    let correctAnswers = 0;

    const questionIds = attemptedQuestionsDistinct.map(
      ({ questionId }) => questionId,
    );

    const questions = await this.db
      .select({
        id: schema.questions.id,
        options: schema.questions.options,
        filledAnswer: schema.questions.filledAnswer,
        type: schema.questions.type,
      })
      .from(schema.questions)
      .where(inArray(schema.questions.id, questionIds))
      .execute();

    for (let i = 0; attemptedQuestionsDistinct.length > i; i++) {
      const attemptedQuestion = attemptedQuestionsDistinct[i];

      const question = questions.find(
        (question) => question.id === attemptedQuestion.questionId,
      );

      // check if its correct answer
      if (
        this.latihanSoalService.isAnswerCorrect(
          {
            type: question.type,
            filledAnswer: question.filledAnswer,
            options: question.options,
          } as Question,
          attemptedQuestion.choiceId || attemptedQuestion.filledAnswers,
        )
      ) {
        correctAnswers++;
      }
    }
    // console.log(se, se.size)

    return {
      streak,
      finished: {
        done: totalAttemptedQuestions,
        total: totalQuestionsCount,
        percentage: Number(
          ((totalAttemptedQuestions / totalQuestionsCount) * 100).toFixed(2),
        ),
      },
      accuracy: {
        percentage: Number(
          ((correctAnswers / attemptIds.length) * 100).toFixed(2),
        ),
        correct_answers: correctAnswers,
        total_attempted_question: attemptIds.length,
      },
    };
  }

  async getDashboard(userId: string) {
    const subjects = [];
    const subjectsQuery = await this.db
      .select({
        subject: schema.subjects.name,
        subjectId: schema.subjects.id,
        topic: schema.topics.name,
        icon: schema.subjects.icon,
        topicId: schema.topics.id,
        slug: schema.subjects.slug,
      })
      .from(schema.subjects)
      .leftJoin(schema.topics, eq(schema.topics.subject_id, schema.subjects.id))
      .execute();

    const topicQuestionsCount = await this.getAllTotalTopicQuestionsCount();

    for (let i = 0; i < subjectsQuery.length; i++) {
      // remove undecided topic
      if (subjectsQuery[i].topic === 'UNDECIDED') {
        continue;
      }

      // remove 0 questions on topic
      if (!topicQuestionsCount[subjectsQuery[i].topicId]) {
        continue;
      }

      subjects.push(subjectsQuery[i]);
    }

    const map = {};

    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i];
      map[subject.subjectId] = {
        id: subject.subjectId,
        name: subject.subject,
        icon: subject.icon,
        slug: subject.slug,
      };
    }

    const mappedTopics = Object.keys(map).map((key) => {
      return {
        subject_id: map[key].id,
        subject: map[key].name,
        topics: [],
        icon: map[key].icon,
        total_correct_answer: 0,
        slug: map[key].slug,
      };
    });

    const topicMapIndex = {};
    const subjectMapIndex = {};

    for (let i = 0; i < mappedTopics.length; i++) {
      const topic = mappedTopics[i];

      subjectMapIndex[topic.subject_id] = i;

      for (let j = 0; j < subjects.length; j++) {
        const subject = subjects[j];
        if (topic.subject_id === subject.subjectId) {
          topic.topics.push({
            topic_id: subject.topicId,
            topic: subject.topic,
            correct: 0,
            total_question: topicQuestionsCount[subject.topicId] || 0,
          });
          topicMapIndex[subject.topic] = topic.topics.length - 1;
        }
      }
    }

    const attemptedQuestionsDistinct = await this.db
      .selectDistinctOn([schema.question_attempts.question_id], {
        id: schema.question_attempts.id,
        choiceId: schema.question_attempts.choice_id,
        filledAnswers: schema.question_attempts.filledAnswers,
        questionId: schema.question_attempts.question_id,
        questionType: schema.questions.type,
        subject: schema.subjects.id,
        topic: schema.topics.name,
        options: schema.questions.options,
        topicId: schema.topics.id,
      })
      .from(schema.question_attempts)
      .orderBy(
        schema.question_attempts.question_id,
        desc(schema.question_attempts.timestamp),
      )
      .leftJoin(
        schema.questions,
        eq(schema.questions.id, schema.question_attempts.question_id),
      )
      .leftJoin(schema.topics, eq(schema.topics.id, schema.questions.topic_id))
      .leftJoin(
        schema.subjects,
        eq(schema.subjects.id, schema.topics.subject_id),
      )
      .where(eq(schema.question_attempts.user_id, userId))
      .execute();

    if (attemptedQuestionsDistinct.length === 0) {
      // sort by topic array length
      mappedTopics.sort((a, b) => {
        return b.topics.length - a.topics.length;
      });
      return mappedTopics;
    }

    for (let i = 0; i < attemptedQuestionsDistinct.length; i++) {
      const attempt = attemptedQuestionsDistinct[i];

      if (
        this.latihanSoalService.isAnswerCorrect(
          {
            type: attempt.questionType,
            filledAnswer: attempt.filledAnswers,
            options: attempt.options,
          } as Question,
          attempt.choiceId || attempt.filledAnswers,
        )
      ) {
        const subjectIndex = subjectMapIndex[attempt.subject];
        const topicIndex = topicMapIndex[attempt.topic];
        if (
          subjectIndex !== undefined &&
          topicIndex !== undefined &&
          mappedTopics[subjectIndex]?.topics[topicIndex]?.correct !== undefined
        ) {
          mappedTopics[subjectIndex].topics[topicIndex].correct += 1;
        } else {
          this.logger.error(
            `Subject or topic index not found for ${attempt.subject} ${attempt.topic} for user ${userId}`,
          );
        }
      } else {
        continue;
      }
    }

    for (let i = 0; i < mappedTopics.length; i++) {
      const mappedTopic = mappedTopics[i];
      for (let j = 0; j < mappedTopic.topics.length; j++) {
        const topic = mappedTopic.topics[j];
        mappedTopic.total_correct_answer += topic.correct;
      }
    }
    // sort by topic array length
    mappedTopics.sort((a, b) => {
      return b.topics.length - a.topics.length;
    });

    return mappedTopics;
  }

  async getDashboardProfile(userId: string) {
    const result = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .execute();

    const subscription = await this.db
      .select()
      .from(schema.transactionOrders)
      .leftJoin(
        schema.transactions,
        eq(schema.transactions.order_id, schema.transactionOrders.id),
      )
      .where(
        and(
          eq(schema.transactionOrders.user_id, userId),
          eq(schema.transactions.user_id, userId),
        ),
      )
      .orderBy(desc(schema.transactions.timestamp))
      .limit(1)
      .execute();

    dayjs.locale('id');

    if (subscription.length > 0) {
      const subscriptionType =
        subscription[0].transaction_orders.subscription_type;
      subscription[0].transaction_orders.subscription_type =
        capitalizeFirstLetter(subscriptionType);
    }

    const isExpired = dayjs(result[0].validity_date).isBefore(dayjs());

    const res = {
      name: result[0].full_name,
      profile_picture: result[0].profile_img,
      referal_code: result[0].referral_code,
      point: (await this.userService.getMyPoints(userId)).totalPoints,
      highschool: result[0].highschool,
      subscription:
        subscription.length > 0 && !isExpired
          ? subscription[0].transaction_orders
          : null,
      validity: {
        timestamp: result[0].validity_date,
        label: dayjs(result[0].validity_date).format('DD MMMM YYYY'),
      },
      phone_number: result[0].phone_number,
      password: result[0].password ? true : false,
    };

    return res;
  }

  async getAllTotalTopicQuestionsCount() {
    const totalQuestions = await this.db
      .select({
        value: sql`count(id)`.mapWith(Number),
        topic_id: schema.questions.topic_id,
      })
      .from(schema.questions)
      .groupBy(schema.questions.topic_id)
      .execute();

    const result = {};

    for (let i = 0; i < totalQuestions.length; i++) {
      const totalQuestion = totalQuestions[i];
      result[totalQuestion.topic_id] = totalQuestion.value;
    }

    return result;
  }

  async uploadProfilePicture(file: Express.Multer.File, userId: string) {
    // upload file
    const filePath = `profile-picture/${userId}-${file.originalname}`;
    const result = await this.s3Service.uploadFile(file, filePath);
    return result;
  }

  async getMobileDashboardRank(userId: string) {
    // TODO: Implement this
    return [
      {
        major: 'Sekolah Teknik Elektro dan Informatika',
        university: 'Institut Teknologi Bandung',
        rank: 1,
        total_rank: 100,
      },
      {
        major: 'Sistem Informasi',
        university: 'Universitas Indonesia',
        rank: 2,
        total_rank: 200,
      },
      {
        major: 'Ilmu Komputer',
        university: 'Universitas Indonesia',
        rank: 3,
        total_rank: 300,
      },
    ];
  }

  async getTryoutDashboard(userId: string) {
    return {
      average_score: 650,
      max_score: 780,
      min_score: 525,
      latest: [
        {
          id: 'uuid',
          tryout_id: 'uuid',
          rank: 1234,
          tryout_name: 'Tryout Pro 1',
          tryout_group: 'UTBK',
        },
        {
          id: 'uuid',
          tryout_id: 'uuid',
          rank: 1233,
          tryout_name: 'Tryout Pro 2',
          tryout_group: 'UTBK',
        },
      ],
    };
  }
}
