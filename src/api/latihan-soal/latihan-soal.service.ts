import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  eq,
  sql,
  inArray,
  desc,
  notInArray,
  gte,
  lte,
  isNotNull,
  isNull,
  not,
} from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DrizzleAsyncProvider } from 'src/database/drizzle/drizzle.provider';
import * as schema from 'src/database/schema';
import {
  AttemptQuestionDto,
  AttemptTimedQuestionDTO,
  ChangeCurrentQuestionDto,
  CreateSequentialQuestionsDto,
} from './latihan-soal.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { S3Service } from 'src/s3/s3.service';
import { truncateLatexText } from 'src/common/lib/utils';
import * as dayjs from 'dayjs';
import { ConfigService } from '@nestjs/config';
import { FirebaseService } from 'src/database/firebase/firebase.service';
import { v4 } from 'uuid';
import { LatihanSoalSummary } from './latihan-soal.type';
import { Content, Question } from 'src/database/schema';

type CachedQuestion = {
  id: string;
  content: string;
  year: number;
};

@Injectable()
export default class LatihanSoalService {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private s3Service: S3Service,
    private configService: ConfigService,
    private firebaseService: FirebaseService,
  ) { }

  async getLatihanSoal(
    subjectId: string,
    userId: string,
    topicId?: string,
    questionId?: string,
    minYear?: number,
    maxYear?: number,
  ) {
    if (!!minYear && !!maxYear && minYear > maxYear) {
      throw new BadRequestException('min year cannot be greater than max year');
    }

    if (!!topicId) {
      const isTopicIdExist = await this.db.query.topics.findFirst({
        where: ({ id }, { eq }) => eq(id, topicId),
      });

      if (!isTopicIdExist) {
        throw new NotFoundException('Topic not found');
      }
    }

    const cachedQuestion: CachedQuestion[] | undefined =
      (await this.cacheManager.get(`questions:${subjectId}:${userId}`)) ??
      (await this.cacheManager.get(
        `questions:${subjectId}:${topicId}:${minYear}:${maxYear}:${userId}`,
      ));

    const undecidedSubject = await this.db.query.subjects.findFirst({
      where: eq(schema.subjects.name, 'UNDECIDED'),
      columns: {
        id: true,
      }
    })

    if (!!cachedQuestion) {
      if (!!questionId) {
        const idx = cachedQuestion.findIndex(({ id }) => id === questionId);
        if (idx === -1) {
          const query = await this.db
            .select()
            .from(schema.questions)
            .where(
              and(
                eq(schema.questions.id, questionId),
                eq(schema.questions.published, true),
                not(eq(schema.questions.subject_id, undecidedSubject.id))
              ),
            )
            .execute();
          if (!query.length) {
            throw new NotFoundException('Question not found');
          }

          const firstContent = query[0].question.find(({ isMedia }) => !isMedia);

          cachedQuestion[0] = {
            id: query[0].id,
            content: truncateLatexText(firstContent.content),
            year: query[0].year,
          };
        }
      }
      return {
        questions: cachedQuestion,
      };
    }

    const attemptedQuestions = (await this.cacheManager.get(
      `user_attempted_question:${subjectId}:${userId}`,
    )) as string[];

    let soal = await this.querySoal(
      subjectId,
      topicId,
      minYear,
      maxYear,
      attemptedQuestions,
    );

    if (soal.length === 0) {
      soal = await this.querySoal(subjectId, topicId, minYear, maxYear);

      await this.resetAttemptedQuestion(
        userId,
        subjectId,
        topicId,
        minYear,
        maxYear,
      );
    }

    // set to cache
    const cleanedSoal = soal.map((soal) => {
      const firstContent = soal.questions.find(({ isMedia }) => !isMedia);

      return {
        id: soal.id,
        content: truncateLatexText(firstContent.content),
        year: soal.year,
      };
    });

    await this.cacheManager.set(
      `questions:${subjectId}:${topicId}:${minYear}:${maxYear}:${userId}`,
      cleanedSoal,
      3600 * 6,
    );

    // insert desired question to random question order
    if (!!questionId) {
      const idx = soal.findIndex(({ id }) => id === questionId);
      if (idx === -1) {
        const query = await this.db
          .select()
          .from(schema.questions)
          .where(
            and(
              eq(schema.questions.id, questionId),
              eq(schema.questions.published, true),
              not(eq(schema.questions.subject_id, undecidedSubject.id))
            ),
          )
          .execute();
        if (!query.length) {
          throw new NotFoundException('Question not found');
        }
        // soal[0] = query[0];
      }
    }

    const res = soal.map((soal) => {
      const firstContent = soal.questions.find(({ isMedia }) => !isMedia);

      return {
        id: soal.id,
        content: truncateLatexText(firstContent.content),
        year: soal.year,
      };
    });

    return {
      questions: res,
    };
  }

  async querySoal(
    subjectId: string,
    topicId?: string,
    minYear?: number,
    maxYear?: number,
    attemptedQuestions?: string[],
  ) {

    const undecidedSubject = await this.db.query.subjects.findFirst({
      where: eq(schema.subjects.name, 'UNDECIDED'),
      columns: {
        id: true,
      }
    })

    return await this.db
      .select({
        id: schema.questions.id,
        year: schema.questions.year,
        topic_id: schema.questions.topic_id,
        subject_id: schema.questions.subject_id,
        questions: schema.questions.question,
      })
      .from(schema.questions)
      .where(
        and(
          !!topicId ? eq(schema.questions.topic_id, topicId) : undefined,
          eq(schema.questions.subject_id, subjectId),
          eq(schema.questions.published, true),
          not(eq(schema.questions.subject_id, undecidedSubject.id)),
          attemptedQuestions && attemptedQuestions.length > 0
            ? notInArray(schema.questions.id, attemptedQuestions)
            : undefined,
          and(
            gte(schema.questions.year, minYear ?? 2010),
            lte(schema.questions.year, maxYear ?? new Date().getFullYear()),
          ),
        ),
      )
      .limit(40)
      .orderBy(sql`random()`);
  }

  async resetAttemptedQuestion(
    userId: string,
    subjectId: string,
    topicId?: string,
    minYear?: number,
    maxYear?: number,
  ) {
    // if there are no topicId, minYear, and maxYear, reset cache
    if (!topicId && !minYear && !maxYear) {
      await this.cacheManager.del(
        `user_attempted_question:${subjectId}:${userId}`,
      );
      return 'Success reset all attempted question';
    }

    // if there are topicId, minYear, or maxYear, just delete questions with applied filters from the cache
    // get all question ids from the cache

    const attemptedQuestions = (await this.cacheManager.get(
      `user_attempted_question:${subjectId}:${userId}`,
    )) as string[];

    if (!attemptedQuestions) {
      return 'No attempted question found';
    }

    let questionIds = [];

    const questionIdsQuery = this.db
      .select({
        id: schema.questions.id,
      })
      .from(schema.questions)
      .where(
        and(
          eq(schema.questions.subject_id, subjectId),
          !!topicId ? eq(schema.questions.topic_id, topicId) : undefined,
          and(
            gte(schema.questions.year, minYear ?? 2010),
            lte(schema.questions.year, maxYear ?? new Date().getFullYear()),
          ),
        ),
      );

    questionIds = await questionIdsQuery.execute();

    questionIds = questionIds.map(({ id }) => id);

    const filteredAttemptedQuestions = attemptedQuestions.filter(
      (id) => !questionIds.includes(id),
    );

    await this.cacheManager.set(
      `user_attempted_question:${subjectId}:${userId}`,
      filteredAttemptedQuestions,
    );

    return 'Success reset attempted question';
  }

  async getAttemptedQuestion(questionId: string, userId: string) {
    if (!userId) {
      throw new BadRequestException('User not found');
    }

    const qattempt = await this.cacheManager.get(
      `qattempt:${questionId}:${userId}`,
    );

    if (!qattempt) {
      return null;
    }

    return qattempt;
  }

  async attemptQuestion(
    questionId: string,
    body: AttemptQuestionDto,
    userId: string,
  ) {
    const { choice_id, answer_history, answers } = body;

    // Check if question exist
    const isQuestionExist = await this.db.query.questions.findFirst({
      where: ({ id }, { eq }) => eq(id, questionId),
    });

    if (!isQuestionExist) {
      throw new NotFoundException('Question not found');
    }

    // qattempt:questionId:userId
    const qattempt = await this.cacheManager.get(
      `qattempt:${questionId}:${userId}`,
    );


    if (!!qattempt) {
      const questionAttempt = await this.db
        .update(schema.question_attempts)
        .set({
          answer_history: answer_history,
          choice_id: choice_id,
          timestamp: new Date(),
          filledAnswers: answers || [],
          user_id: userId,
        })
        .where(eq(schema.question_attempts.id, (qattempt as any).id))
        .returning()
        .execute();

      await this.cacheManager.set(
        `qattempt:${questionId}:${userId}`,
        {
          ...questionAttempt[0],
          type: isQuestionExist.type
        },
        3600 * 6,
      );
      return questionAttempt[0];
    } else {
      const questionAttempt = await this.db
        .insert(schema.question_attempts)
        .values({
          answer_history: answer_history,
          choice_id: choice_id,
          question_id: questionId,
          timestamp: new Date(),
          user_id: userId,
          filledAnswers: answers || [],
        })
        .returning()
        .execute();

      await this.cacheManager.set(
        `qattempt:${questionId}:${userId}`,
        {
          ...questionAttempt[0],
          type: isQuestionExist.type
        },
        3600 * 6,
      );
      return questionAttempt[0];
    }
  }

  async deleteAttemptedQuestion(questionId: string, userId: string) {
    await this.cacheManager.del(`qattempt:${questionId}:${userId}`);
  }

  async getPembahasan(questionId: string, userId: string, attemptId?: string) {

    const user = await this.db.query.users.findFirst({
      where: ({ id }, { eq }) => eq(id, userId),
      columns: {
        validity_date: true,
      },
    });

    const isUserSubscribed = dayjs(user.validity_date).isAfter(dayjs());

    const question = await this.db.query.questions.findFirst({
      where: ({ id }, { eq }) => eq(id, questionId),
      columns: {
        answers: true,
        id: true,
        options: true,
        filledAnswer: true,
        type: true
      },
    });



    if (!attemptId) {
      if (!isUserSubscribed) {
        return {
          is_correct: false,
          correct_answer: `You are not premium account`,
          attempt: {
            filled_answer: [],
            choice_id: "",
            answer_history: "",
          },
          type: question.type
        };
      } else {
        // return not correct answer for attempting but not submitting
        const correctAnswer = question.options.filter(
          ({ is_true }) => is_true,
        )[0];

        return {
          is_correct: false,
          correct_answer: {
            answer: question.answers,
            choice: correctAnswer ?? null,
            filled_answer: question.filledAnswer.map((answer)=>{
              return answer.toString()
            }),
          },
          attempt: {
            filled_answer: [],
            choice_id: "",
            answer_history: "",
          },
          type: question.type
        };
      }
    }

    const qattempt = await this.db.query.question_attempts.findFirst({
      where: and(eq(schema.question_attempts.id, attemptId), eq(schema.question_attempts.user_id, userId), eq(schema.question_attempts.question_id, questionId))
    });

    if (!qattempt) {
      throw new NotFoundException('Attempt not found');
    }

    const answerAttempt = qattempt.choice_id || qattempt.filledAnswers;

    const isAnswerCorrect = this.isAnswerCorrect(question as Question, answerAttempt);

    if (!isUserSubscribed) {
      return {
        is_correct: isAnswerCorrect,
        correct_answer: `You are not premium account`,
        attempt: {
          filled_answer: qattempt.filledAnswers,
          choice_id: qattempt.choice_id,
          answer_history: qattempt.answer_history,
        },
        type: question.type
      };
    }
    return {
      is_correct: isAnswerCorrect,
      correct_answer: {
        answer: question.answers,
        choice: question.options,
        filled_answer: question.filledAnswer.map((answer)=> {
          return answer.toString()
        }),
      },
      attempt: {
        filled_answer: qattempt.filledAnswers,
        choice_id: qattempt.choice_id,
        answer_history: qattempt.answer_history,
      },
      type: question.type
    };
  }

  async getAttemptHistories(
    userId: string,
    subjectId: string,
    topicId?: string,
  ) {
    let questionIds = [];

    const questionIdsQuery = this.db
      .select({
        id: schema.questions.id,
      })
      .from(schema.questions)
      .where(eq(schema.questions.subject_id, subjectId));

    if (!!topicId) {
      questionIds = await questionIdsQuery
        .where(eq(schema.questions.topic_id, topicId))
        .execute();
    } else {
      questionIds = await questionIdsQuery.execute();
    }

    questionIds = questionIds.map(({ id }) => id);

    const attemptHistories = await this.db
      .select()
      .from(schema.question_attempts)
      .where(
        and(
          eq(schema.question_attempts.user_id, userId),
          inArray(schema.question_attempts.question_id, questionIds),
        ),
      )
      .orderBy(desc(schema.question_attempts.timestamp))
      .execute();

    const result = {
      count: attemptHistories.length,
      histories: attemptHistories,
    };

    return result;
  }

  async getLatihanSoalById(questionId: string, userId: string) {
    const soals = await this.db
      .select()
      .from(schema.questions)
      .where(
        and(
          eq(schema.questions.id, questionId),
          eq(schema.questions.published, true),
        ),
      )
      .leftJoin(schema.topics, eq(schema.topics.id, schema.questions.topic_id))
      .execute();

    const soal = soals[0];

    const subject = await this.db.query.subjects.findFirst({
      where: eq(schema.subjects.id, soal.questions.subject_id),
    })

    // remove the is_true
    const options = soal.questions.options.map(({ is_true, ...rest }) => rest);
    const ret = {
      id: soal.questions.id,
      content: soal.questions.question,
      topic: soal.topics.name,
      label: `${soal.questions.source} ${soal.questions.year}`,
      subject: `${soal.questions.subject_id}`,
      subject_name: subject.name,
      options: options,
      last_attempted: null,
      type: soal.questions.type,
    }

    // sort the options if its multiple choice questions
    const lastAttempted = await this.db.query.question_attempts.findFirst({
      where: and(
        eq(schema.question_attempts.question_id, questionId),
        eq(schema.question_attempts.user_id, userId),
        isNotNull(schema.question_attempts.submitted),
        isNull(schema.question_attempts.timed_questions_id),
      ),
      orderBy: desc(schema.question_attempts.timestamp),
    });

    if (lastAttempted) {
      ret.last_attempted = lastAttempted.timestamp;
    }

    const result = ret;

    if (!result) {
      throw new NotFoundException('Question not found');
    }

    return result;
  }

  async submitAttempt(attemptId: string, userId: string) {
    const attempt = await this.db
      .update(schema.question_attempts)
      .set({
        submitted: new Date(),
      })
      .where(eq(schema.question_attempts.id, attemptId))
      .returning()
      .execute();

    if (!attempt[0]) {
      throw new NotFoundException('Attempt not found');
    }

    const question = await this.db.query.questions.findFirst({
      where: eq(schema.questions.id, attempt[0].question_id),
    })

    const answer = question.type == 'multiple-choice' ? attempt[0].choice_id : attempt[0].filledAnswers;
    const isCorrect = this.isAnswerCorrect(question, answer);

    this.firebaseService.addUserHistoryPoint(
      userId,
      isCorrect ? 20 : 10,
      `attempt question: ${attempt[0].question_id}`,
    );

    await this.cacheManager.set(
      `qattempt:${attempt[0].question_id}:${attempt[0].user_id}`,
      attempt[0],
    );

    const { subject_id } = await this.db.query.questions.findFirst({
      where: eq(schema.questions.id, attempt[0].question_id),
    });

    const userAttemptedQuestion = (await this.cacheManager.get(
      `user_attempted_question:${subject_id}:${userId}`,
    )) as string[];

    if (userAttemptedQuestion && userAttemptedQuestion.length > 0) {
      await this.cacheManager.set(
        `user_attempted_question:${subject_id}:${userId}`,
        Array.from(new Set([...userAttemptedQuestion, attempt[0].question_id])),
      );
    } else {
      await this.cacheManager.set(
        `user_attempted_question:${subject_id}:${userId}`,
        [attempt[0].question_id],
      );
    }

    return attempt[0];
  }

  async generatePDF(
    subjectId: string,
    userId: string,
    topicId?: string,
    minYear?: number,
    maxYear?: number,
  ) {
    let topicName = '';
    const isSubjectExist = await this.db.query.subjects.findFirst({
      where: eq(schema.subjects.id, subjectId),
    });

    if (!isSubjectExist) {
      throw new NotFoundException(`Subject not found`);
    }

    if (!!topicId) {
      const isTopicExist = await this.db.query.topics.findFirst({
        where: eq(schema.topics.id, topicId),
      });

      topicName = isTopicExist.name;

      if (!isTopicExist) {
        throw new NotFoundException('Topic not Found');
      }

      // is topic belong to subject
      const isSubjectToTopicExist = await this.db.query.topics.findFirst({
        where: and(
          eq(schema.topics.id, topicId),
          eq(schema.topics.subject_id, subjectId),
        ),
      });

      if (!isSubjectToTopicExist)
        throw new NotFoundException("Topic doesn't belong to subject");
    }

    let cachedQuestion: CachedQuestion[] | undefined =
      (await this.cacheManager.get(`questions:${subjectId}:${userId}`)) ??
      (await this.cacheManager.get(
        `questions:${subjectId}:${topicId}:${minYear}:${maxYear}:${userId}`,
      ));


    if (!cachedQuestion || cachedQuestion.length === 0) {
      const latsol = await this.getLatihanSoal(subjectId, userId, topicId, undefined, minYear, maxYear);

      cachedQuestion = latsol.questions;
    }

    const soalIds = cachedQuestion.map(({ id }) => id);

    const soal = await this.db
      .select()
      .from(schema.questions)
      .where(inArray(schema.questions.id, soalIds))
      .leftJoin(schema.topics, eq(schema.topics.id, schema.questions.topic_id))
      .leftJoin(
        schema.subjects,
        eq(schema.subjects.id, schema.questions.subject_id),
      )
      .execute();


    const result = soal.map((soal) => {
      const { questions, topics } = soal;

      const cleanedQuestionsContent = questions.question.map((content) => {
        let cleanedContent = content.content;

        // change the [ISIAN] to ...
        if (!content.isMedia && questions.type == 'fill-in') {
          cleanedContent = content.content.replace(
            /\[ISIAN\]/g, ' ____ '
          )
        }

        return {
          content: cleanedContent,
          isMedia: content.isMedia
        } as Content
      })


      const cleanedOptions = (questions.options).map((option) => {
        return {
          content: option.content,
          key: option.key,
        };
      });

      const sortedKeyCleanedOptions = cleanedOptions.sort((a, b) => {
        if (a.key < b.key) {
          return -1;
        }
        if (a.key > b.key) {
          return 1;
        }
        return 0;
      });

      return {
        id: questions.id,
        content: cleanedQuestionsContent,
        topic: topics.name,
        label: `${questions.source} ${questions.year}`,
        options: questions.type === 'fill-in' ? null : sortedKeyCleanedOptions,
        slug: soal.subjects.slug,
        type: questions.type
      };
    });

    const toBeGenerated = JSON.stringify({
      topic: topicName ? topicName : isSubjectExist.name,
      subject: isSubjectExist.name,
      data: result,
    });

    const buffer = Buffer.from(toBeGenerated, 'utf-8');

    const fileName = `questions:${subjectId}:${topicId}:${userId}:${new Date().getTime()}.json`;

    await this.s3Service.uploadFile(buffer, `pdf-soal/${fileName}`);

    const pdfUrl = this.configService.get('PDF_URL');

    const url = `${pdfUrl}/${fileName}`;

    const subjectName: string = soal[0].subjects.slug
    const topicSlug = topicName ? `${topicName}-` : '';
    const generatedUrl = `${subjectName}-${topicSlug}${userId.substring(0, 3)}`;

    await this.db.insert(schema.pdf).values({
      filename: fileName,
      url: url,
      subject_id: subjectId,
      topic_id: topicId ?? null,
      generated_url: generatedUrl,
      user_id: userId,
    });

    return {
      url: generatedUrl,
    };

  }

  async generateTuringPDF(topicId: string) {
    const topic = await this.db.query.topics.findFirst({
      where: eq(schema.topics.id, topicId),
    });

    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    const subject = await this.db.query.subjects.findFirst({
      where: eq(schema.subjects.id, topic.subject_id),
    });

    if (!subject) {
      throw new NotFoundException('Subject not found');
    }

    const cachedValue = await this.cacheManager.get(`turing:${topicId}`);

    if (cachedValue) {
      return cachedValue;
    }

    const soal = await this.db
      .select()
      .from(schema.questions)
      .leftJoin(
        schema.subjects,
        eq(schema.subjects.id, schema.questions.subject_id),
      )
      .where(eq(schema.questions.topic_id, topicId))
      .limit(5)
      .orderBy(sql`random()`)
      .execute();

    const cleanedSoal = soal.map((soal) => {
      return {
        id: soal.questions.id,
        content: soal.questions.question,
        year: soal.questions.year,
        source: soal.questions.source,
        pembahasan: soal.questions.answers,
        options: soal.questions.options,
        label: `${soal.questions.source} ${soal.questions.year}`,
        slug: soal.subjects.slug,
      };
    });

    const res = {
      soal: cleanedSoal,
      topic: topic.name,
      subject: subject.name,
    };

    await this.cacheManager.set(`turing:${topicId}`, res);

    return res;
  }

  async randomizePDFTuring(topicId: string) {
    const cachedValue = await this.cacheManager.get(`turing:${topicId}`);
    if (!cachedValue) {
      return 'ok';
    } else {
      await this.cacheManager.del(`turing:${topicId}`);
    }
    return 'ok';
  }

  async getPdf(generatedUrl: string) {
    const pdf = await this.db.query.pdf.findFirst({
      where: eq(schema.pdf.generated_url, generatedUrl),
      orderBy: desc(schema.pdf.timestamp),
    });

    if (!pdf) {
      throw new NotFoundException('PDF Url not found');
    }

    return pdf;
  }

  async addFeedback(
    questionId: string,
    userId: string,
    isLike: boolean,
    feedback?: string,
  ) {
    await this.db
      .insert(schema.question_feedbacks)
      .values({
        question_id: questionId,
        user_id: userId,
        is_like: isLike,
        feedback: feedback ?? '',
      })
      .execute();
    return {
      message: 'Feedback submitted',
    };
  }

  async getFeedback(questionId: string, userId: string) {
    const feedback = await this.db
      .select()
      .from(schema.question_feedbacks)
      .where(
        and(
          eq(schema.question_feedbacks.question_id, questionId),
          eq(schema.question_feedbacks.user_id, userId),
        ),
      )
      .orderBy(desc(schema.question_feedbacks.timestamp))
      .limit(1)
      .execute();

    return {
      feedback: feedback[0] ?? null,
    };
  }

  async updateFeedback(
    feedbackId: string,
    isLike: boolean,
    feedback: string = ' ',
  ) {
    const isFeedbackExist = await this.db.query.question_feedbacks.findFirst({
      where: eq(schema.question_feedbacks.id, feedbackId),
    });

    if (!isFeedbackExist) throw new NotFoundException('Feedback not found');

    await this.db
      .update(schema.question_feedbacks)
      .set({
        is_like: isLike,
        feedback: feedback ?? isFeedbackExist.feedback,
      })
      .where(eq(schema.question_feedbacks.id, feedbackId))
      .execute();

    return {
      message: 'Feedback updated',
    };
  }

  async uploadSubmissionAsset(
    file: Express.Multer.File,
    attemptId: string,
    userId: string,
  ) {
    const now = new Date().getTime();

    const filePath = `submissions/${userId}/${attemptId}-${now}-${file.originalname}`;

    const res = await this.s3Service.uploadFile(file, filePath);

    const isAttemptExist = await this.db.query.question_attempts.findFirst({
      where: ({ id, user_id }, { eq, and }) =>
        and(eq(id, attemptId), eq(user_id, userId)),
    });

    if (!isAttemptExist) {
      throw new NotFoundException('Attempt not found');
    }

    await this.db
      .insert(schema.question_attempt_assets)
      .values({
        asset_url: res.url,
        question_attempts_id: attemptId,
      })
      .returning()
      .execute();

    return {
      url: res.url,
      key: res.key,
    };
  }


  async createSequentialQuestions(
    body: CreateSequentialQuestionsDto,
    userId: string,
    subjectId: string,
  ) {

    console.log('start createSequential service')
    const { topic_ids, max_number } = body;

    // Check if user has a running sequential question
    const isSequentialQuestionExist = await this.getCurrentSequentialQuestion(
      userId,
    );

    if (isSequentialQuestionExist) {
      throw new BadRequestException('You have a running sequential question');
    }

    const isSubjectExist = await this.db.query.subjects.findFirst({
      where: eq(schema.subjects.id, subjectId),
    });

    if (!isSubjectExist) {
      throw new NotFoundException('Subject not found');
    }

    let alreadyShowedQuestions: string[] = await this.cacheManager.get(
      `sequential:${subjectId}:${topic_ids}:${userId}`,
    );

    const undecidedSubject = await this.db.query.subjects.findFirst({
      where: eq(schema.subjects.name, 'UNDECIDED'),
      columns: {
        id: true,
      }
    })

    const queryFilter = () => {
      if (topic_ids.length > 0 && alreadyShowedQuestions?.length > 0) {
        return and(
          eq(schema.questions.subject_id, subjectId),
          inArray(schema.questions.topic_id, topic_ids),
          notInArray(schema.questions.id, alreadyShowedQuestions),
          eq(schema.questions.published, true),
          eq(schema.questions.type, 'multiple-choice'),
          not(eq(schema.questions.subject_id, undecidedSubject.id))
        );
      } else if (topic_ids.length > 0) {
        return and(
          eq(schema.questions.subject_id, subjectId),
          inArray(schema.questions.topic_id, topic_ids),
          eq(schema.questions.published, true),
          eq(schema.questions.type, 'multiple-choice'),
          not(eq(schema.questions.subject_id, undecidedSubject.id))
        );
      } else if (alreadyShowedQuestions?.length > 0) {
        return and(
          eq(schema.questions.subject_id, subjectId),
          notInArray(schema.questions.id, alreadyShowedQuestions),
          eq(schema.questions.published, true),
          eq(schema.questions.type, 'multiple-choice'),
          not(eq(schema.questions.subject_id, undecidedSubject.id))
        );
      }
      return and(eq(schema.questions.subject_id, subjectId), eq(schema.questions.type, 'multiple-choice'), eq(schema.questions.published, true), not(eq(schema.questions.subject_id, undecidedSubject.id)));
    };

    const questions = await this.db
      .select({
        id: schema.questions.id,
      })
      .from(schema.questions)
      .where(queryFilter())
      .limit(max_number)
      .orderBy(sql`random()`)
      .execute();


    // if max_number is greater than the questions length, get random questions from the already showed questions
    if (alreadyShowedQuestions?.length && max_number > questions.length) {
      console.log('get random questions from the already showed questions')
      const difference = max_number - questions.length;

      // get random questions from the already showed questions
      const alreadyShowedQuestionsQuery = await this.db
        .select({
          id: schema.questions.id,
        })
        .from(schema.questions)
        .where(
          and(
            eq(schema.questions.subject_id, subjectId),
            inArray(schema.questions.id, alreadyShowedQuestions),
            eq(schema.questions.published, true),
            not(eq(schema.questions.subject_id, undecidedSubject.id))
          ),
        )
        .limit(difference)
        .orderBy(sql`random()`)
        .execute();

      questions.push(...alreadyShowedQuestionsQuery);

      // reset already showed questions
      await this.cacheManager.del(
        `sequential:${subjectId}:${topic_ids}:${userId}`,
      );
      console.log('reset already showed questions')
    }

    if (questions.length < max_number) {
      throw new BadRequestException('Not enough questions');
    }

    if (!alreadyShowedQuestions) {
      alreadyShowedQuestions = [];
    }

    // put it on already showedQuestions
    await this.cacheManager.set(
      `sequential:${subjectId}:${topic_ids}:${userId}`,
      [...alreadyShowedQuestions, ...questions.map((q) => q.id)],
      3600 * 72,
    );

    console.log('insert sequential question to database')

    // insert sequential question to database
    const sequentialQuestion = await this.db
      .insert(schema.timed_questions)
      .values({
        maxNumber: max_number,
        subjectId: subjectId,
        userId: userId,
        mode: 'sequential',
        questionIds: questions.map((q) => q.id),
      })
      .returning()
      .execute();

    console.log('end createSequential service')

    return sequentialQuestion;
  }

  /** TODO: update points on unsubmitted timed question */
  async getCurrentTimedQuestion(userId: string) {
    const latestCurrentTimedQuestion =
      await this.db.query.timed_questions.findFirst({
        where: eq(schema.timed_questions.userId, userId),
        orderBy: desc(schema.timed_questions.createdAt),
      });

    if (!latestCurrentTimedQuestion) {
      return null;
    }

    if (latestCurrentTimedQuestion.mode == 'sequential') {
      if (
        latestCurrentTimedQuestion.maxNumber ==
        latestCurrentTimedQuestion.currentNumber
      ) {
        await this.db
          .update(schema.timed_questions)
          .set({
            submitted: new Date(),
          })
          .where(eq(schema.timed_questions.id, latestCurrentTimedQuestion.id))
          .execute();
        return null;
      }
    }

    // check if its already submitted
    if (latestCurrentTimedQuestion.submitted) {
      return null;
    }

    // check is the time is already expired
    const isStillValid = await this.isStillValidTimedQuestion(
      latestCurrentTimedQuestion.id,
    );

    if (!isStillValid) {
      return null;
    }

    if (latestCurrentTimedQuestion.currentQuestion) {
      const question = await this.db.query.questions.findFirst({
        where: eq(
          schema.questions.id,
          latestCurrentTimedQuestion.currentQuestion,
        ),
      });

      latestCurrentTimedQuestion.subjectId = question.subject_id;
    }

    const questionAttemptCount = await this.db.query.question_attempts.findMany(
      {
        where: eq(
          schema.question_attempts.timed_questions_id,
          latestCurrentTimedQuestion.id,
        ),
      },
    );

    const createdAt = latestCurrentTimedQuestion.createdAt;
    const subjectId = latestCurrentTimedQuestion.subjectId;
    const maxNumber = latestCurrentTimedQuestion.maxNumber;
    const currentNumber = latestCurrentTimedQuestion.currentNumber;
    const current_question_id: string =
      latestCurrentTimedQuestion.currentQuestion;

    delete latestCurrentTimedQuestion.createdAt;
    delete latestCurrentTimedQuestion.subjectId;
    delete latestCurrentTimedQuestion.maxNumber;
    delete latestCurrentTimedQuestion.currentNumber;
    delete latestCurrentTimedQuestion.userId;
    delete latestCurrentTimedQuestion.questionIds;
    delete latestCurrentTimedQuestion.currentQuestion;

    const res = {
      ...latestCurrentTimedQuestion,
      user_id: userId,
      created_at: createdAt,
      subject_id: subjectId,
      max_number: maxNumber,
      current_number: currentNumber + 1,
      current_question_id: current_question_id,
      finished_question: questionAttemptCount.length,
    };

    if (res.mode === 'classic') {
      const subject = await this.db.query.subjects.findFirst({
        where: eq(schema.subjects.id, subjectId),
      });

      res['time_limit'] = 11700; // 190 minutes
      res['slug'] = `${subject.slug}/${currentNumber + 1}`;
    }

    return res;
  }

  async getCurrentSequentialQuestion(userId: string) {
    const timedQuestion = await this.db.query.timed_questions.findFirst({
      where: eq(schema.timed_questions.userId, userId),
      orderBy: desc(schema.timed_questions.createdAt),
    });

    if (!timedQuestion) {
      return null;
    }

    if (timedQuestion.mode !== 'sequential') {
      return null;
    }

    const isValidtimedQuestion = await this.isStillValidTimedQuestion(
      timedQuestion.id,
    );

    if (!isValidtimedQuestion) {
      return null;
    }

    const currentNumber = timedQuestion.currentNumber;

    const currentQuestionId = timedQuestion.questionIds[currentNumber];

    if (!currentQuestionId) {
      return null;
    }

    const question = await this.db
      .select({
        questions: {
          id: schema.questions.id,
          content: schema.questions.question,
          year: schema.questions.year,
          source: schema.questions.source,
          subject: schema.subjects.name,
          topic: schema.topics.name,
        },
        options: schema.questions.options,
      })
      .from(schema.questions)
      .leftJoin(
        schema.subjects,
        eq(schema.subjects.id, schema.questions.subject_id),
      )
      .leftJoin(schema.topics, eq(schema.topics.id, schema.questions.topic_id))
      .where(eq(schema.questions.id, currentQuestionId))
      .execute();

    const currentAttempt = await this.getCurrentAttemptTimedQuestion(
      timedQuestion.id,
    );

    // remove is true from options
    question[0].options = question[0].options.map((option) => {
      delete option.is_true;
      return option;
    });

    const timeLimit =
      await this.db.query.timed_questions_time_mapping.findFirst({
        where: eq(
          schema.timed_questions_time_mapping.subjectId,
          timedQuestion.subjectId,
        ),
      });

    const res = {
      time_limit: timeLimit?.timeLimit,
      timed_question_id: timedQuestion.id,
      content: question[0].questions,
      options: question[0].options,
      attempt: currentAttempt ?? null,
      current_number: currentNumber + 1,
      topic: question[0].questions.topic,
      subject: question[0].questions.subject,
    };

    return res;
  }

  async attemptTimedQuestion(
    timedQuestionId: string,
    userId: string,
    body: AttemptTimedQuestionDTO,
  ) {
    const { answer_history, choice_id, answers } = body;
    const timedQuestion = await this.db.query.timed_questions.findFirst({
      where: eq(schema.timed_questions.id, timedQuestionId),
    });

    if (!timedQuestion) {
      throw new NotFoundException('Sequential question not found');
    }

    if (timedQuestion.userId !== userId) {
      throw new BadRequestException('Invalid user attempt timed question');
    }

    if (timedQuestion.currentNumber >= timedQuestion.maxNumber) {
      throw new BadRequestException('Invalid question number');
    }

    const questionId = timedQuestion.questionIds.find(
      (id) => body.question_id == id,
    );

    const value = {
      question_id: questionId,
      user_id: timedQuestion.userId,
      answer_history: answer_history,
      choice_id: choice_id || null,
      timed_questions_id: timedQuestionId,
      filledAnswers: answers || [],
    };

    await this.db
      .insert(schema.question_attempts)
      .values(value)
      .onConflictDoUpdate({
        target: [
          schema.question_attempts.timed_questions_id,
          schema.question_attempts.question_id,
        ],
        set: value,
      })
      .execute();
  }

  async nextSequentialQuestion(sequentialId: string) {
    const sequentialQuestion = await this.db.query.timed_questions.findFirst({
      where: eq(schema.timed_questions.id, sequentialId),
    });

    if (!sequentialQuestion) {
      throw new NotFoundException('Sequential question not found');
    }

    const currentNumber = sequentialQuestion.currentNumber;

    const nextNumber = currentNumber + 1;

    const attemptQuestionId = sequentialQuestion.questionIds[currentNumber];

    await this.db
      .update(schema.question_attempts)
      .set({
        submitted: new Date(),
      })
      .where(
        and(
          eq(schema.question_attempts.question_id, attemptQuestionId),
          eq(schema.question_attempts.timed_questions_id, sequentialId),
        ),
      )
      .returning()
      .execute();

    await this.db
      .update(schema.timed_questions)
      .set({
        currentNumber: nextNumber,
      })
      .where(eq(schema.timed_questions.id, sequentialId))
      .execute();


    if (currentNumber >= sequentialQuestion.questionIds.length - 1) {
      await this.db
        .update(schema.timed_questions)
        .set({
          submitted: new Date(),
        })
        .where(eq(schema.timed_questions.id, sequentialId));

      return {
        next_question_id: null,
      };
    }

    return {
      next_question_id: sequentialQuestion.questionIds[nextNumber],
    };
  }

  async getCurrentAttemptTimedQuestion(timedQuestionId: string) {
    const sequentialQuestion = await this.db.query.timed_questions.findFirst({
      where: eq(schema.timed_questions.id, timedQuestionId),
    });

    if (!sequentialQuestion) {
      throw new NotFoundException('Sequential question not found');
    }

    const currentNumber = sequentialQuestion.currentNumber;

    const questionId = sequentialQuestion.questionIds[currentNumber];

    const questionAttempt = await this.db.query.question_attempts.findFirst({
      where: and(
        eq(schema.question_attempts.question_id, questionId),
        eq(schema.question_attempts.timed_questions_id, timedQuestionId),
      ),
      columns: {
        id: true,
        choice_id: true,
        filledAnswers: true,
      },
    });

    return questionAttempt;
  }

  async getTimedQuestionSummary(
    userId: string,
    timedQuestionId: string,
  ): Promise<LatihanSoalSummary> {
    const cachedSummary: LatihanSoalSummary = await this.cacheManager.get(
      `timed_question_summary:${userId}:${timedQuestionId}`,
    );

    if (cachedSummary) {
      return cachedSummary;
    }

    const timedQuestion = await this.db.query.timed_questions.findFirst({
      where: and(
        eq(schema.timed_questions.id, timedQuestionId),
        eq(schema.timed_questions.userId, userId),
      ),
    });

    if (!timedQuestion) {
      throw new NotFoundException('Timed questions not found');
    }

    if (!timedQuestion.submitted) {
      if (this.isStillValidTimedQuestion(timedQuestionId)) {
        throw new BadRequestException('Timed question is still running');
      }
    }

    const questionIds = timedQuestion.questionIds;

    const questionAttempts = await this.db.query.question_attempts.findMany({
      where: and(
        inArray(schema.question_attempts.question_id, questionIds),
        eq(schema.question_attempts.timed_questions_id, timedQuestionId),
      ),
    });

    const attemptedOptions = questionAttempts.map(
      ({ choice_id, question_id, filledAnswers }) => {
        return {
          choice_id,
          question_id,
          filledAnswers,
        };
      },
    );


    const questions = await this.db.query.questions.findMany({
      where: inArray(schema.questions.id, questionIds),
      columns: {
        id: true,
        options: true,
        filledAnswer: true,
        type: true
      }
    })

    const correctChoicesMap = {};

    questions.forEach(({ id, options, type, filledAnswer }) => {
      if (type === 'multiple-choice') {
        const correctChoices = options.filter(({ is_true }) => is_true)?.[0];
        if (!correctChoices) return;
        correctChoicesMap[id] = correctChoices.id;
      } else {
        correctChoicesMap[id] = filledAnswer
      }
    });

    let correctAnswer = 0;

    for (let i = 0; i < attemptedOptions.length; i++) {
      if (
        attemptedOptions[i].choice_id ===
        correctChoicesMap[attemptedOptions[i].question_id] || attemptedOptions[i].filledAnswers === correctChoicesMap[attemptedOptions[i].question_id]
      ) {
        correctAnswer++;
      }
    }

    const accuracy = ((correctAnswer / timedQuestion.maxNumber) * 100).toFixed(
      2,
    );

    const point = correctAnswer * 30;

    const res = {
      id: timedQuestionId,
      accuracy,
      avg_time: '0.00',
      point,
      correct_answer_count: correctAnswer,
      total_question: timedQuestion.maxNumber,
      created_at: timedQuestion.createdAt,
      mode: timedQuestion.mode,
    };

    if (timedQuestion.mode == 'classic') {
      // calculate the average time

      // calculate submitted time seconds from its created
      const submittedTime = timedQuestion.submitted
        ? dayjs(timedQuestion.submitted)
        : dayjs(timedQuestion.createdAt).add(11700, 'second');

      const createdTime = dayjs(timedQuestion.createdAt);

      const timeDiff = submittedTime.diff(createdTime, 'second');

      const avgTime = (timeDiff / questionAttempts.length).toFixed(2);

      res['avg_time'] = avgTime;
      res['label'] = `Soal Klasik`;
    } else {

      const questionAttempts = await this.db.query.question_attempts.findMany({
        where: and(
          inArray(schema.question_attempts.question_id, questionIds),
          eq(schema.question_attempts.timed_questions_id, timedQuestionId),
        ),
        orderBy: desc(schema.question_attempts.timestamp),
      });

      // calculate the avg time by adding all of the time from the created to the submitted property
      let totalDiff = 0;

      const subject = await this.db.query.subjects.findFirst({
        where: eq(schema.subjects.id, timedQuestion.subjectId),
      });

      for (let i = 0; i < questionAttempts.length; i++) {
        const timeLimitSubject = await this.db.query.timed_questions_time_mapping.findFirst({
          where: eq(schema.timed_questions_time_mapping.subjectId, subject.id),
        })

        const submittedTime = questionAttempts[i].submitted
          ? dayjs(questionAttempts[i].submitted)
          : dayjs(
            timedQuestion.submitted ??
            timeLimitSubject.timeLimit,
          );
        const createdTime = dayjs(questionAttempts[i].timestamp);
        totalDiff += submittedTime.diff(createdTime, 'second');
      }

      const avgTime = (totalDiff / questionAttempts.length).toFixed(2);

      res['avg_time'] = avgTime;
      res[
        'label'
      ] = `${timedQuestion.maxNumber} Soal ${subject.alternate_name}`;
    }

    if (questionAttempts.length < 1) {
      res['avg_time'] = '0.00';
    }

    await this.cacheManager.set(
      `timed_question_summary:${userId}:${timedQuestionId}`,
      res,
      3600 * 24 * 4,
    );

    return res;
  }

  async isStillValidTimedQuestion(timedQuestionId: string) {
    const timedQuestion = await this.db.query.timed_questions.findFirst({
      where: eq(schema.timed_questions.id, timedQuestionId),
    });

    if (timedQuestion.submitted) return false;

    let timeLimit = 0;
    // check is the time is already expired
    // check if mode is sequential
    if (timedQuestion.mode === 'sequential') {
      const { timeLimit: sequentialTimeLimit } =
        await this.db.query.timed_questions_time_mapping.findFirst({
          where: eq(
            schema.timed_questions_time_mapping.subjectId,
            timedQuestion.subjectId,
          ),
          columns: {
            timeLimit: true,
          },
        });
      timeLimit = sequentialTimeLimit;
    } else if (timedQuestion.mode === 'classic') {
      timeLimit = 11700;
    }

    if (
      dayjs(timedQuestion.createdAt).add(timeLimit, 'second').isBefore(dayjs())
    ) {
      return false;
    }
    return true;
  }

  async createClassicTimedQuestions(userId: string) {
    const isRunningTimedClassicQuestion = await this.getCurrentTimedQuestion(
      userId,
    );

    if (isRunningTimedClassicQuestion)
      throw new BadRequestException('You have a running timed question');

    let alreadyShowedQuestion = await this.cacheManager.get(
      `classic:${userId}`,
    );

    const generateId = v4();

    const subjects = await this.db
      .select()
      .from(schema.timed_questions_time_mapping)
      .leftJoin(
        schema.subjects,
        eq(schema.subjects.id, schema.timed_questions_time_mapping.subjectId),
      )
      .where(
        eq(schema.subjects.year, '2025'),
      )
      .execute();

    const subjectMap = {};

    subjects.forEach(({ subjects }) => {
      subjectMap[subjects.id] = [];
    });

    if (!alreadyShowedQuestion) {
      await this.cacheManager.set(`classic:${userId}`, subjectMap);
      alreadyShowedQuestion = subjectMap;
    }

    const questions = [];
    const questionBySubjectInsertValues = [];

    const undecidedSubject = await this.db.query.subjects.findFirst({
      where: eq(schema.subjects.name, 'UNDECIDED'),
      columns: {
        id: true,
      }
    })

    for (let i = 0; i < subjects.length; i++) {
      const questionBySubject = [];
      const { subjects: subj } = subjects[i];

      const subjectId = subjects[i].subjects.id;

      const limit = await this.db.query.timed_questions_time_mapping.findFirst({
        where: eq(schema.timed_questions_time_mapping.subjectId, subjectId),
        columns: {
          questionLimit: true,
        },
      })

      const filter =
        alreadyShowedQuestion[subj.id].length > 0
          ? and(
            notInArray(schema.questions.id, alreadyShowedQuestion[subj.id]),
            eq(schema.questions.subject_id, subj.id),
            eq(schema.questions.published, true),
            eq(schema.questions.type, 'multiple-choice'),
            not(eq(schema.questions.subject_id, undecidedSubject.id))
          )
          : and(
            eq(schema.questions.subject_id, subj.id),
            eq(schema.questions.published, true),
            eq(schema.questions.type, 'multiple-choice'),
            not(eq(schema.questions.subject_id, undecidedSubject.id))
          );

      const questionsQuery = await this.db
        .select({
          id: schema.questions.id,
        })
        .from(schema.questions)
        .where(filter)
        .orderBy(sql`random()`)
        .limit(limit.questionLimit)
        .execute();

      questions.push(...questionsQuery);
      questionBySubject.push(...questionsQuery.map(({ id }) => id));

      if (limit.questionLimit - questionsQuery.length > 0) {
        const difference = limit.questionLimit - questionsQuery.length;
        const alreadyShowedQuestionIds = alreadyShowedQuestion[subj.id];
        if (alreadyShowedQuestionIds?.length) {
          const filteredQuestions = await this.db
            .select()
            .from(schema.questions)
            .where(
              and(
                eq(schema.questions.subject_id, subj.id),
                inArray(schema.questions.id, alreadyShowedQuestionIds),
                eq(schema.questions.type, 'multiple-choice'), // TODO: Change this to be handling other question type
                not(eq(schema.questions.subject_id, undecidedSubject.id))
              ),
            )
            .orderBy(sql`random()`)
            .limit(difference)
            .execute();

          questions.push(...filteredQuestions.map(({ id }) => ({ id })));
          questionBySubject.push(...filteredQuestions.map(({ id }) => id));
          alreadyShowedQuestion[subj.id] = [];
        }
      } else {
        const questionIds = questionsQuery.map(({ id }) => id);
        alreadyShowedQuestion[subj.id] = [
          ...alreadyShowedQuestion[subj.id],
          ...questionIds,
        ];
      }

      await this.cacheManager.set(`classic:${userId}`, alreadyShowedQuestion);

      questionBySubjectInsertValues.push({
        subjectId: subj.id,
        questionIds: questionBySubject,
        timedQuestionId: generateId,
      });
    }

    const timedQuestion = await this.db
      .insert(schema.timed_questions)
      .values({
        id: generateId,
        maxNumber: questions.length,
        questionIds: questions.map(({ id }) => id),
        userId: userId,
        currentNumber: 0,
        currentQuestion: questions[0].id,
      })
      .returning()
      .execute();

    await this.db
      .insert(schema.timed_questions_classic_questions)
      .values(questionBySubjectInsertValues)
      .execute();


    return {
      id: timedQuestion[0].id,
      max_number: timedQuestion[0].maxNumber,
      user_id: userId,
      current_number: 0,
      subject_ids: subjects.map(({ subjects }) => subjects.id),
      current_question: timedQuestion[0].currentQuestion,
    };
  }

  async getAttemptedTimedQuestions(
    userId: string,
    questionId: string,
    timedQuestionId: string,
  ) {
    const timedQuestion = await this.db.query.timed_questions.findFirst({
      where: eq(schema.timed_questions.id, timedQuestionId),
    });

    if (!timedQuestion)
      throw new NotFoundException('Timed Questions not found!');

    const attemptedTimedQuestions =
      await this.db.query.question_attempts.findFirst({
        where: and(
          eq(schema.question_attempts.timed_questions_id, timedQuestionId),
          eq(schema.question_attempts.user_id, userId),
          eq(schema.question_attempts.question_id, questionId),
        ),
      });

    if (!attemptedTimedQuestions) return null;

    const res = {
      ...attemptedTimedQuestions,
    };

    if (timedQuestion.mode == 'sequential') {
      const subject = await this.db.query.subjects.findFirst({
        where: eq(schema.subjects.id, timedQuestion.subjectId),
        columns: {
          name: true,
        },
      });
      res['subject'] = subject.name;
      res['current_number'] =
        timedQuestion.questionIds.findIndex(
          (id) => id == attemptedTimedQuestions.question_id,
        ) + 1;
    }

    return res;
  }

  async changeTimedQuestionCurrentQuestion(
    timedQuestionId: string,
    query: ChangeCurrentQuestionDto,
  ) {
    const { question_id, current_number } = query;

    const timedQuestion = await this.db.query.timed_questions.findFirst({
      where: eq(schema.timed_questions.id, timedQuestionId),
    });

    if (!timedQuestion) {
      throw new NotFoundException('Timed question not found');
    }

    // check if questionId is exist in timedQuestion
    const questionIds = timedQuestion.questionIds;

    if (!questionIds.includes(question_id)) {
      throw new NotFoundException('Question not found');
    }

    await this.db
      .update(schema.timed_questions)
      .set({
        currentQuestion: question_id,
        currentNumber: current_number,
      })
      .where(eq(schema.timed_questions.id, timedQuestionId))
      .execute();

    return {
      current_question: question_id,
    };
  }

  async getTimedQuestionListBySubjectId(
    timedQuestionId: string,
    subjectId: string,
    userId: string,
  ) {
    const timedQuestion = await this.db.query.timed_questions.findFirst({
      where: eq(schema.timed_questions.id, timedQuestionId),
    });

    if (!timedQuestion) {
      throw new NotFoundException('Timed question not found');
    }

    const { questionIds, id } =
      await this.db.query.timed_questions_classic_questions.findFirst({
        where: and(
          eq(
            schema.timed_questions_classic_questions.timedQuestionId,
            timedQuestionId,
          ),
          eq(schema.timed_questions_classic_questions.subjectId, subjectId),
        ),
      });

    if (!questionIds || !questionIds.length) {
      throw new NotFoundException('Question not found');
    }

    const questionMap = {};

    questionIds.forEach((id) => {
      questionMap[id] = false;
    });


    const questionAttempt = await this.db.query.question_attempts.findMany({
      where: and(
        inArray(schema.question_attempts.question_id, questionIds),
        eq(schema.question_attempts.timed_questions_id, timedQuestionId),
        eq(schema.question_attempts.user_id, userId),
      ),
    });

    console.log('successfully get question attempt')

    questionAttempt.forEach(({ question_id }) => {
      questionMap[question_id] = true;
    });

    console.log('successfully get timed questions list')

    return questionMap;
  }

  async getCurrentQuestionTimedQuestion(timedQuestionId: string) {
    const timedQuestion = await this.db.query.timed_questions.findFirst({
      where: eq(schema.timed_questions.id, timedQuestionId),
    });

    if (!timedQuestion) {
      throw new NotFoundException('Timed question not found');
    }

    const question = await this.db.query.questions.findFirst({
      where: eq(schema.questions.id, timedQuestion.currentQuestion),
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    if (timedQuestion.mode === 'sequential') {
      return {
        current_number: timedQuestion.currentNumber,
      };
    } else {
      return {
        question_id: question.id,
        subject_id: question.subject_id,
      };
    }
  }

  async submitTimedQuestion(timedQuestionId: string) {
    const timedQuestion = await this.db.query.timed_questions.findFirst({
      where: eq(schema.timed_questions.id, timedQuestionId),
    });

    if (!timedQuestion) {
      throw new NotFoundException('Timed question not found');
    }

    if (timedQuestion.submitted) {
      throw new BadRequestException('Timed question already submitted');
    }

    await this.db.transaction(async (trx) => {
      if (timedQuestion.mode === 'classic') {
        await trx
          .update(schema.question_attempts)
          .set({
            submitted: new Date(),
          })
          .where(
            eq(schema.question_attempts.timed_questions_id, timedQuestionId),
          )
          .execute();
      } else if (timedQuestion.mode == 'sequential') {
        const currentNumber = timedQuestion.currentNumber;
        const questionId = timedQuestion.questionIds[currentNumber];

        await trx
          .update(schema.question_attempts)
          .set({
            submitted: new Date(),
          })
          .where(
            and(
              eq(schema.question_attempts.question_id, questionId),
              eq(schema.question_attempts.timed_questions_id, timedQuestion.id),
            ),
          )
          .returning()
          .execute();

        await trx
          .update(schema.timed_questions)
          .set({
            currentNumber: currentNumber + 1,
          })
          .where(eq(schema.timed_questions.id, timedQuestion.id))
          .execute();
      }

      await trx
        .update(schema.timed_questions)
        .set({
          submitted: new Date(),
        })
        .where(eq(schema.timed_questions.id, timedQuestionId))
        .execute();
    });

    const { point } = await this.getTimedQuestionSummary(
      timedQuestion.userId,
      timedQuestionId,
    );

    await this.firebaseService.addUserHistoryPoint(
      timedQuestion.userId,
      point,
      `Submit Timed Question: ${timedQuestionId}`,
    );

    return {
      message: `Timed Question ${timedQuestion.id} submitted`,
    };
  }

  async getTimedQuestionsHistory(userId: string, timedQuestionId: string) {
    const timedQuestion = await this.db.query.timed_questions.findFirst({
      where: eq(schema.timed_questions.id, timedQuestionId),
    });

    if (!timedQuestion) {
      throw new NotFoundException('Timed question not found');
    }

    // sequential
    const correctOptions = {};

    const questionAttempt = await this.db.query.question_attempts.findMany({
      where: and(
        eq(schema.question_attempts.timed_questions_id, timedQuestionId),
        eq(schema.question_attempts.user_id, userId),
      ),
      columns: {
        choice_id: true,
        question_id: true,
        filledAnswers: true,
        id: true,
      },
    });
    const attemptedQuestions = {};

    const undecidedSubject = await this.db.query.subjects.findFirst({
      where: eq(schema.subjects.name, 'UNDECIDED'),
      columns: {
        id: true,
      }
    })

    const questions = await this.db.query.questions.findMany({
      where: and(
        inArray(
          schema.questions.id,
          timedQuestion.questionIds.map((id) => id),
        ),
        eq(schema.questions.published, true),
        not(eq(schema.questions.subject_id, undecidedSubject.id))
      ),
    });

    if (questionAttempt?.length > 0) {
      questions.forEach(({ options, filledAnswer, type, id }) => {
        if (type === 'multiple-choice') {
          const correctChoice = options.find(({ is_true }) => is_true)?.id;
          correctOptions[id] = correctChoice;
        } else if (type === 'fill-in') {
          correctOptions[id] = filledAnswer;
        } else {
          const correctChoicesTable = []
          for (let i = 0; i < options.length; i++) {
            if (options[i].is_true) {
              correctChoicesTable.push('TRUE')
            } else {
              correctChoicesTable.push('FALSE')
            }
          }
          correctOptions[id] = correctChoicesTable
        }
      });

      questionAttempt.forEach(({ choice_id, filledAnswers, question_id }) => {
        const question = questions.find(({ id }) => id === question_id);
        attemptedQuestions[question.id] = this.isAnswerCorrect(question, choice_id);
      });
    }


    const res = {
      mode: timedQuestion.mode,
      label: '',
      subject_ids: [],
      questions: {},
    };

    const subjectIds = [];

    if (timedQuestion.mode === 'sequential') {
      subjectIds.push(timedQuestion.subjectId);
    } else {
      // get all subjectIds from the mapping
      const subjectIdsQuery =
        await this.db.query.timed_questions_classic_questions.findMany({
          where: eq(
            schema.timed_questions_classic_questions.timedQuestionId,
            timedQuestionId,
          ),
          columns: {
            subjectId: true,
            questionIds: true,
          },
        });
      subjectIds.push(...subjectIdsQuery.map(({ subjectId }) => subjectId));

      subjectIdsQuery.forEach(({ subjectId, questionIds }) => {
        const cleanedQuetionsIds = []
        // remove unpublished questions
        for (let i = 0; i < questionIds.length; i++) {
          if (!questions.find(({ id }) => id === questionIds[i])) {
            continue
          } else {
            cleanedQuetionsIds.push(questionIds[i])
          }
        }

        res.questions[subjectId] = cleanedQuetionsIds.map((id) => {
          return {
            question_id: id,
            is_correct: attemptedQuestions[id] ?? false,
          };
        });
      });
    }

    res.subject_ids = subjectIds;

    if (timedQuestion.mode === 'sequential') {
      const cleanedResult = timedQuestion.questionIds.filter((id) => {
        // remove unpublished questions
        return questions.find(({ id: questionId }) => questionId === id)
      })

      const result = [];

      cleanedResult.forEach((id) => {
        result.push({
          question_id: id,
          is_correct: attemptedQuestions[id] ?? false,
        });
      });

      const subject = await this.db.query.subjects.findMany({
        where: inArray(schema.subjects.id, subjectIds),
        columns: {
          alternate_name: true,
          id: true,
        },
      });
      res.label = `${timedQuestion.maxNumber} Soal ${subject[0].alternate_name}`;
      res.questions = {
        [subject[0].id]: result,
      };
    } else {
      res.label = 'Soal Klasik';
    }

    return res;
  }

  async getAllCurrentAttemptedTimedQuestion(
    userId: string,
    timedQuestionId: string,
  ) {
    const timedQuestion = await this.db.query.timed_questions.findFirst({
      where: eq(schema.timed_questions.id, timedQuestionId),
    });

    if (!timedQuestion) {
      throw new NotFoundException('Timed question not found');
    }

    const questionAttempt = await this.db.query.question_attempts.findMany({
      where: and(
        eq(schema.question_attempts.timed_questions_id, timedQuestionId),
        eq(schema.question_attempts.user_id, userId),
      ),
      columns: {
        choice_id: true,
        question_id: true,
      },
    });

    const attemptedQuestions = {};

    if (questionAttempt?.length > 0) {
      questionAttempt.forEach(({ question_id }) => {
        attemptedQuestions[question_id] = true;
      });
    }

    const result = [];

    timedQuestion.questionIds.forEach((id) => {
      result.push({
        question_id: id,
        is_attempted: attemptedQuestions[id] ?? false,
      });
    });

    const res = {
      mode: timedQuestion.mode,
      label: '',
      subject_ids: [],
      questions: {},
    };

    const subjectIds = [];

    if (timedQuestion.mode === 'sequential') {
      subjectIds.push(timedQuestion.subjectId);
    } else {
      // get all subjectIds from the mapping
      const subjectIdsQuery =
        await this.db.query.timed_questions_classic_questions.findMany({
          where: eq(
            schema.timed_questions_classic_questions.timedQuestionId,
            timedQuestionId,
          ),
          columns: {
            subjectId: true,
            questionIds: true,
          },
        });
      subjectIds.push(...subjectIdsQuery.map(({ subjectId }) => subjectId));

      subjectIdsQuery.forEach(({ subjectId, questionIds }) => {
        res.questions[subjectId] = questionIds.map((id) => {
          return {
            question_id: id,
            is_attempted: attemptedQuestions[id] ?? false,
          };
        });
      });
    }

    const subject = await this.db.query.subjects.findMany({
      where: inArray(schema.subjects.id, subjectIds),
      columns: {
        alternate_name: true,
        id: true,
      },
    });

    res.subject_ids = subject.map(({ id }) => id);

    if (timedQuestion.mode === 'sequential') {
      res.label = `${timedQuestion.maxNumber} Soal ${subject[0].alternate_name}`;
      res.questions = {
        [subject[0].id]: result,
      };
    } else {
      res.label = 'Soal Klasik';
    }

    return res;
  }

  async getTempQuestions() {
    const questions = await this.db.query.tempQuestionSubject.findMany({
      columns: {
        newSubjectId: true,
        newSubjectName: true,
        newTopicId: true,
        newTopicName: true,
        oldSubjectId: true,
        oldSubjectName: true,
        oldTopicName: true,
        questionId: true,
        oldTopicId: true
      }
    });

    const questionsMap = {};

    for(let i=0; i<questions.length; i++) {
      questionsMap[questions[i].questionId] = {
        ...questions[i]
      }
    }

    return questionsMap;
  }


  isAnswerCorrect(question: Question, answer: string[] | string) {

    let isCorrect = false;

    switch (question.type) {
      case 'fill-in': {
        if (answer instanceof String) {
          // add logger for error
          return false;
        }
        isCorrect = JSON.stringify(question.filledAnswer) == JSON.stringify(answer);
        return isCorrect;
      }
      case 'multiple-choice': {
        // answer is asnwerId if its multiple choice question
        if (answer instanceof Array) {

          // add logger for error
          return false;
        }
        isCorrect = question.options.find((option) => option.is_true)?.id == answer;
        return isCorrect;
      }

      case 'table-choice': {
        if (answer instanceof String) {
          // add logger for error
          return false;
        }

        const options = question.options;

        // ["TRUE", "FALSE"] --> question_attempts

        isCorrect = true;

        for (let i = 0; i < options.length; i++) {

          const correctOpt = options[i].is_true ? "TRUE" : "FALSE";

          if (answer[i] !== correctOpt) {

            isCorrect = false;
            break;
          }

        }
        return isCorrect;
      }
      case 'multiple-answer': {
        if (answer instanceof String) {
          // add logger for error
          return false;
        }
        const options = question.options;
        const givenAnswers = new Set(answer);
        const correctOptions = new Set(options.filter(({ is_true }) => is_true).map(({ id }) => id));

        if (givenAnswers.size !== correctOptions.size) return false
        isCorrect = true;

        for (let i = 0; i < options.length; i++) {
          const option = options[i];
          if (option.is_true && !givenAnswers.has(option.id)) {
            isCorrect = false;
            break;
          }
        }
        return isCorrect;
      }

      default:
        return isCorrect;
    }

  }
}
