import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DrizzleAsyncProvider } from 'src/database/drizzle/drizzle.provider';
import * as schema from 'src/database/schema';
import { and, eq, sql, asc, gt, desc, or } from 'drizzle-orm';
import * as dayjs from 'dayjs';
import { TryoutProgressEnum } from './tryout.enum';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

@Injectable()
class TryoutService {
  readonly logger = new Logger(TryoutService.name);

  constructor(
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async getAllActiveTryouts(
    userId: string,
    mode: string = 'kilat',
    progress: string = TryoutProgressEnum.ALL,
  ) {
    const isKilat = mode == 'kilat';

    const tryouts = await this.db
      .selectDistinct({
        id: schema.tryouts.id,
        name: schema.tryouts.name,
        start_date: schema.tryouts.startDate,
        started_at: schema.tryout_attempts.startedAt,
        submitted_at: schema.tryout_attempts.submittedAt,
        end_date: schema.tryouts.expiryDate,
        current_set_id: schema.tryout_attempts.currentTryoutSetId,
        expiry_date: schema.tryouts.expiryDate,
        event_name: schema.tryouts.eventName,
        is_window: schema.tryouts.isWindow,
      })
      .from(schema.tryouts)
      .leftJoin(
        schema.tryout_attempts,
        and(
          eq(schema.tryout_attempts.tryoutId, schema.tryouts.id),
          eq(schema.tryout_attempts.userId, userId),
        ),
      )
      .innerJoin(
        // having at least 1 set
        schema.tryout_sets,
        eq(schema.tryout_sets.tryoutId, schema.tryouts.id),
      )
      .where(
        and(
          eq(schema.tryouts.isKilat, isKilat),
          eq(schema.tryouts.isPublished, true),
        ),
      )
      .orderBy(desc(schema.tryouts.startDate));

    for (let i = 0; i < tryouts.length; i++) {
      if (tryouts[i].started_at !== null) {
        const timeLimit = await this.getTryoutTimeLimitOfUser(
          tryouts[i].id,
          userId,
        );

        if (
          dayjs(timeLimit).isBefore(dayjs()) &&
          tryouts[i].submitted_at === null &&
          tryouts[i].is_window === false
        ) {
          // update submitted_at the attempt
          const submitted = await this.db
            .update(schema.tryout_attempts)
            .set({ submittedAt: timeLimit })
            .where(
              and(
                eq(schema.tryout_attempts.tryoutId, tryouts[i].id),
                eq(schema.tryout_attempts.userId, userId),
              ),
            )
            .returning({
              submittedAt: schema.tryout_attempts.submittedAt,
            })
            .execute();
          tryouts[i].submitted_at = submitted[0].submittedAt;
        }
      }
    }

    const filteredTryouts = [];
    for (let i = 0; i < tryouts.length; i++) {
      const tryout = tryouts[i];
      if (
        progress === TryoutProgressEnum.NOT_STARTED &&
        tryout.started_at === null &&
        tryout.submitted_at === null
      ) {
        filteredTryouts.push(tryout);
      } else if (
        progress === TryoutProgressEnum.ON_GOING &&
        tryout.started_at !== null &&
        tryout.submitted_at === null
      ) {
        filteredTryouts.push(tryout);
      } else if (
        progress === TryoutProgressEnum.FINISHED &&
        tryout.started_at !== null &&
        tryout.submitted_at !== null
      ) {
        filteredTryouts.push(tryout);
      } else if (progress === TryoutProgressEnum.ALL) {
        filteredTryouts.push(tryout);
      }
    }

    return { mode, tryouts: filteredTryouts };
  }

  async getCurrentTryoutState(userId: string) {
    const latestTryoutAttempt = await this.db
      .select()
      .from(schema.tryout_attempts)
      .where(and(eq(schema.tryout_attempts.userId, userId)))
      .orderBy(desc(schema.tryout_attempts.startedAt))
      .limit(1);

    if (!latestTryoutAttempt.length) {
      return null; // there are no active tryouts
    }

    if (latestTryoutAttempt[0].submittedAt) {
      return null; // there are no active tryouts
    }

    const tryout = await this.db.query.tryouts.findFirst({
      where: eq(schema.tryouts.id, latestTryoutAttempt[0].tryoutId),
      columns: {
        id: true,
        name: true,
        description: true,
        label: true,
        timeLimit: true,
        eventName: true,
        expiryDate: true,
        firstSetId: true,
        logoSrc: true,
        isWindow: true,
      },
    });

    const res = {
      tryout_id: null,
      current_set: null,
      total_duration: null,
      end_time: null,
      started_at: null,
      next_set_id: null,
      next_subject: null,
      next_set_duration: null,
      tryout: {
        id: tryout.id,
        name: tryout.name,
        description: tryout.description,
        label: tryout.label,
        time_limit: tryout.timeLimit,
        event_name: tryout.eventName,
        expiry_date: tryout.expiryDate,
        logo_src: tryout.logoSrc,
        is_window: tryout.isWindow,
      },
    };
    // get total duration
    const totalDuration = await this.getTryoutTotalDuration(
      latestTryoutAttempt[0].tryoutId,
    );

    res.total_duration = totalDuration;
    res.started_at = latestTryoutAttempt[0].startedAt;
    res.tryout_id = latestTryoutAttempt[0].tryoutId;

    // check if latest TO is exceeding the time limit
    const timeLimit = await this.getTryoutTimeLimitOfUser(
      latestTryoutAttempt[0].tryoutId,
      userId,
    );
    if (dayjs().isAfter(dayjs(timeLimit)) && !tryout.isWindow) {
      // update submitted_at the attempt
      await this.db
        .update(schema.tryout_attempts)
        .set({ submittedAt: timeLimit })
        .where(
          and(
            eq(schema.tryout_attempts.id, latestTryoutAttempt[0].id),
            eq(schema.tryout_attempts.userId, userId),
          ),
        )
        .execute();

      return null;
    }

    // get current set attempt
    const currentSetAttempt = latestTryoutAttempt[0].currentTryoutSetId;

    if (!currentSetAttempt) {
      const tryout = await this.db.query.tryouts.findFirst({
        where: eq(schema.tryouts.id, latestTryoutAttempt[0].tryoutId),
      });

      const nextSet = await this.db.query.tryout_sets.findFirst({
        where: eq(schema.tryout_sets.id, tryout.firstSetId),
      });

      const isFirstSetIsAttempted =
        await this.db.query.tryout_set_attempts.findFirst({
          where: and(
            eq(schema.tryout_set_attempts.tryoutSetId, nextSet.id),
            eq(schema.tryout_set_attempts.userId, userId),
          ),
        });

      if (nextSet && !isFirstSetIsAttempted) {
        res.next_set_id = nextSet.id;
        const nextSubject = await this.db.query.tryout_subjects.findFirst({
          where: eq(schema.tryout_subjects.id, nextSet.subjectId),
        });

        res.next_subject = nextSubject.name;
        res.next_set_duration = nextSet.duration;
      }
      return res;
    } else {
      const latestSetAttempt =
        await this.db.query.tryout_set_attempts.findFirst({
          where: and(
            eq(schema.tryout_set_attempts.tryoutSetId, currentSetAttempt),
            eq(schema.tryout_set_attempts.userId, userId),
          ),
        });

      if (!latestSetAttempt) {
        const nextSet = await this.db.query.tryout_sets.findFirst({
          where: eq(schema.tryout_sets.id, currentSetAttempt),
        });
        const nextSubject = await this.db.query.tryout_subjects.findFirst({
          where: eq(schema.tryout_subjects.id, nextSet.subjectId),
        });

        res.current_set = null;
        res.next_set_duration = nextSet.duration;
        res.next_set_id = nextSet.id;
        res.next_subject = nextSubject.name;
        return res;
      }

      // get the tryout set
      const currentSet = await this.db.query.tryout_sets.findFirst({
        where: eq(schema.tryout_sets.id, latestSetAttempt.tryoutSetId),
      });
      // check if the current set is exceeding the time limit
      const setTimeLimit = dayjs(latestSetAttempt.startedAt)
        .add(currentSet.duration, 'second')
        .toDate();

      if (
        (dayjs().isAfter(timeLimit) || dayjs().isAfter(setTimeLimit)) &&
        !tryout.isWindow
      ) {
        this.logger.log(
          `Time limit on current set: ${currentSet.id} is exceeded. Submitting the set...`,
        );
        // update submitted_at the attempt
        await this.db
          .update(schema.tryout_set_attempts)
          .set({
            submittedAt: timeLimit < setTimeLimit ? timeLimit : setTimeLimit,
          })
          .where(eq(schema.tryout_set_attempts.id, latestSetAttempt.id))
          .execute();

        if (dayjs().isAfter(timeLimit) && !tryout.isWindow) {
          // submit the tryout
          await this.db
            .update(schema.tryout_attempts)
            .set({
              submittedAt: timeLimit,
            })
            .where(eq(schema.tryout_attempts.id, latestTryoutAttempt[0].id))
            .execute();

          return null;
        }
        const nextSet = await this.getNextTryoutSet(
          latestTryoutAttempt[0].currentTryoutSetId,
        );

        if (nextSet) {
          // update the current set of the tryout attempt
          await this.db
            .update(schema.tryout_attempts)
            .set({
              currentTryoutSetId: nextSet.id,
            })
            .where(eq(schema.tryout_attempts.id, latestTryoutAttempt[0].id))
            .execute();
        }

        res.next_set_id = nextSet.id;
        const nextSubject = await this.db.query.tryout_subjects.findFirst({
          where: eq(schema.tryout_subjects.id, nextSet.subjectId),
        });

        res.next_subject = nextSubject.name;
        res.next_set_duration = nextSet.duration;

        return res;
      } else {
        this.logger.log(
          `Time limit on current set: ${currentSet.id} is not exceeded. Continuing the set...`,
        );

        res.current_set = latestSetAttempt;

        res.current_set.end_time = dayjs(latestSetAttempt.startedAt).add(
          currentSet.duration,
          'second',
        );

        res.current_set.duration = currentSet.duration;

        // get the subject name
        const subjectName = await this.db.query.tryout_subjects.findFirst({
          where: eq(schema.tryout_subjects.id, currentSet.subjectId),
          columns: {
            name: true,
          },
        });

        res.current_set.subject_name = subjectName.name;

        const nextSet = await this.getNextTryoutSet(
          latestTryoutAttempt[0].currentTryoutSetId,
        );

        if (nextSet) {
          res.next_set_id = nextSet.id;

          const nextSubject = await this.db.query.tryout_subjects.findFirst({
            where: eq(schema.tryout_subjects.id, nextSet.subjectId),
          });

          res.next_subject = nextSubject.name;
          res.next_set_duration = nextSet.duration;
        }

        this.logger.log(`Successfully fetched current tryout state`);

        return res;
      }
    }
  }

  async getNextTryoutSet(tryoutSetId: string) {
    const currentSet = await this.db.query.tryout_sets.findFirst({
      where: eq(schema.tryout_sets.id, tryoutSetId),
    });

    const nextTryoutSets = await this.db
      .select()
      .from(schema.tryout_sets)
      .where(eq(schema.tryout_sets.id, currentSet.nextSet));

    return nextTryoutSets[0];
  }

  async getTryoutDetails(tryoutId: string) {
    const tryouts = await this.db
      .select({
        id: schema.tryouts.id,
        name: schema.tryouts.name,
        expiry_date: schema.tryouts.expiryDate,
        description: schema.tryouts.description,
        is_kilat: schema.tryouts.isKilat,
        buffer_duration: schema.tryouts.bufferDuration,
        started_at: schema.tryouts.startDate,
        event_name: schema.tryouts.eventName,
        is_window: schema.tryouts.isWindow,
      })
      .from(schema.tryouts)
      .where(
        and(
          eq(schema.tryouts.id, tryoutId),
          eq(schema.tryouts.isPublished, true),
        ),
      )
      .limit(1);
    if (!tryouts.length)
      throw new NotFoundException(`Tryout with id '${tryoutId}' is not found`);

    const tryout = tryouts[0];

    const tryout_sets = await this.db
      .select({
        id: schema.tryout_sets.id,
        subject_id: schema.tryout_sets.subjectId,
        subject_name: schema.tryout_subjects.name,
        duration: schema.tryout_sets.duration,
        total_questions: sql<number>`cast(count(${schema.tryout_questions.id}) as int)`,
      })
      .from(schema.tryout_sets)
      .where(eq(schema.tryout_sets.tryoutId, tryoutId))
      .leftJoin(
        schema.tryout_questions,
        eq(schema.tryout_sets.id, schema.tryout_questions.tryoutSetId),
      )
      .groupBy(schema.tryout_sets.id, schema.tryout_subjects.name)
      .innerJoin(
        schema.tryout_subjects,
        eq(schema.tryout_sets.subjectId, schema.tryout_subjects.id),
      )
      .orderBy(asc(schema.tryout_sets.createdAt));

    let totalSetsQuestions: number = 0;
    let totalSetsDuration: number = 0;
    tryout_sets.forEach((set) => {
      totalSetsQuestions += set.total_questions;
      totalSetsDuration += set.duration;
    });
    // buffer duration is not calculated in Kilat mode
    const totalDuration = tryout.is_kilat
      ? totalSetsDuration
      : tryout.buffer_duration + totalSetsDuration;

    return {
      ...tryout,
      sets: tryout_sets,
      total_sets_questions: totalSetsQuestions,
      total_sets_durations: totalSetsDuration,
      total_duration: totalDuration,
    };
  }

  async getAllQuestionsInSet(setId: string, userId: string) {
    // check if user has started this set
    const setAndAttempt = await this.db
      .select()
      .from(schema.tryout_sets)
      .where(eq(schema.tryout_sets.id, setId))
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
      )
      .limit(1);
    if (!setAndAttempt.length)
      throw new NotFoundException(`Tryout set is not found`);
    const subject = setAndAttempt[0].tryout_subjects;
    const setAttempt = setAndAttempt[0].tryout_set_attempts;
    if (!setAttempt)
      throw new BadRequestException(`You have not started this set`);

    const questions = await this.db
      .select({
        id: schema.tryout_questions.id,
        type: schema.tryout_questions.type,
        filled_answers: schema.tryout_question_attempts.filledAnswers,
        answer: schema.tryout_question_attempts.answer,
        is_flagged: schema.tryout_question_attempts.isFlagged,
      })
      .from(schema.tryout_questions)
      .where(eq(schema.tryout_questions.tryoutSetId, setId))
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
      .orderBy(asc(schema.tryout_questions.createdAt));

    const formattedQuestions = questions.map((question) => {
      return {
        id: question.id,
        is_answered:
          !!question.answer ||
          (question.type !== 'multiple-choice' && !!question.filled_answers),
        is_flagged: question.is_flagged === null ? false : question.is_flagged,
      };
    });

    return {
      subject_name: subject.name,
      questions: formattedQuestions,
      current_question_id: setAttempt.currentQuestionId,
    };
  }

  async getQuestionDetails(setId: string, questionId: string, userId: string) {
    // check if user has started this set
    const setAndAttempt = await this.db
      .select()
      .from(schema.tryout_sets)
      .where(eq(schema.tryout_sets.id, setId))
      .leftJoin(
        schema.tryout_set_attempts,
        and(
          eq(schema.tryout_set_attempts.tryoutSetId, schema.tryout_sets.id),
          eq(schema.tryout_set_attempts.userId, userId),
        ),
      )
      .limit(1);
    if (!setAndAttempt.length)
      throw new NotFoundException(`Tryout set is not found`);
    const setAttempt = setAndAttempt[0].tryout_set_attempts;
    if (!setAttempt)
      throw new BadRequestException(`You have not started this set`);

    // check if question is in set
    const question = await this.db.query.tryout_questions.findFirst({
      where: ({ id, tryoutSetId }, { and, eq }) =>
        and(eq(id, questionId), eq(tryoutSetId, setId)),
      columns: {
        id: true,
        content: true,
        isTextAnswer: true,
        options: true,
        source: true,
        contentImage: true,
        type: true,
      },
    });
    if (!question)
      throw new NotFoundException(`Question not found in tryout set`);

    // check if options object is string
    if (typeof question.options === 'string') {
      question.options = JSON.parse(question.options);
    }

    let formattedOptions = [];

    // hide correct answer
    if (question.type !== 'fill-in') {
      formattedOptions = question.options.map((option) => {
        const { is_true, ...other } = option;
        return other;
      });
    }

    // get the subject
    const subject = await this.db.query.tryout_subjects.findFirst({
      where: eq(
        schema.tryout_subjects.id,
        setAndAttempt[0].tryout_sets.subjectId,
      ),
      columns: {
        name: true,
      },
    });

    const formattedQuestion = {
      id: question.id,
      content: question.content,
      options: formattedOptions,
      is_text_answer: question.isTextAnswer,
      source: question.source,
      subject_name: subject.name,
      answer: null,
      option_id: null,
      is_flagged: false,
      content_asset: question.contentImage,
      type: question.type,
      filled_answers: null,
    };

    const questionAttempt =
      await this.db.query.tryout_question_attempts.findFirst({
        where: (attempt, { and, eq }) =>
          and(
            eq(attempt.tryoutQuestionId, questionId),
            eq(attempt.userId, userId),
          ),
        columns: {
          answer: true,
          optionId: true,
          isFlagged: true,
          filledAnswers: true,
        },
      });
    if (questionAttempt) {
      formattedQuestion.is_flagged = questionAttempt.isFlagged;
      formattedQuestion.answer = questionAttempt.answer;
      formattedQuestion.option_id = questionAttempt.optionId;
      formattedQuestion.filled_answers = questionAttempt.filledAnswers;
    }

    return formattedQuestion;
  }

  async answerQuestion(
    setId: string,
    userId: string,
    questionId: string,
    answer: string,
    filled_answers: string[],
  ) {
    // check if either answer or filled_answers is provided
    if (!answer && !filled_answers.length) {
      throw new BadRequestException(`Answer is required`);
    }

    // check if user has attempted the set
    const setAttempts = await this.db
      .select({
        id: schema.tryout_set_attempts.id,
        started_at: schema.tryout_set_attempts.startedAt,
        submitted_at: schema.tryout_set_attempts.submittedAt,
        duration: schema.tryout_sets.duration,
        tryout_id: schema.tryout_sets.tryoutId,
      })
      .from(schema.tryout_set_attempts)
      .where(
        and(
          eq(schema.tryout_set_attempts.tryoutSetId, setId),
          eq(schema.tryout_set_attempts.userId, userId),
        ),
      )
      .innerJoin(
        schema.tryout_sets,
        eq(schema.tryout_set_attempts.tryoutSetId, schema.tryout_sets.id),
      )
      .limit(1);
    if (!setAttempts.length)
      throw new UnauthorizedException(`Please start the tryout set first`);

    // check if user already submitted the set
    const setAttempt = setAttempts[0];
    if (setAttempt.submitted_at)
      throw new BadRequestException(
        `You have finished this set, thus can't change any of your answer`,
      );

    // check if user has exceed the set duration given from started_at
    const tryoutId = setAttempt.tryout_id;
    const setTimeLimit = dayjs(setAttempt.started_at).add(
      setAttempt.duration,
      'second',
    );
    const tryoutTimeLimit = dayjs(
      await this.getTryoutTimeLimitOfUser(tryoutId, userId),
    );
    const timeLimit = tryoutTimeLimit.isBefore(setTimeLimit)
      ? tryoutTimeLimit
      : setTimeLimit;

    if (dayjs().isAfter(timeLimit)) {
      const submittedAt = timeLimit.toDate();
      // update submitted_at the attempt
      await this.db
        .update(schema.tryout_set_attempts)
        .set({ submittedAt })
        .where(eq(schema.tryout_set_attempts, setAttempt.id))
        .returning();
      throw new BadRequestException(`You have exceeded the time limit`);
    }

    // check if question exists in set
    const questionQuery = await this.db
      .select()
      .from(schema.tryout_questions)
      .where(
        and(
          eq(schema.tryout_questions.id, questionId),
          eq(schema.tryout_questions.tryoutSetId, setId),
        ),
      )
      .limit(1);

    if (!questionQuery.length)
      throw new NotFoundException(`Question not found in tryout set`);

    const question = questionQuery[0];

    // check if user attempted the question
    const questionAttempt =
      await this.db.query.tryout_question_attempts.findFirst({
        where: and(
          eq(schema.tryout_question_attempts.tryoutQuestionId, questionId),
          eq(schema.tryout_question_attempts.userId, userId),
        ),
      });

    // Store answer in question attempt
    let updatedAttempts: {
      id: string;
      tryoutId: string;
      userId: string;
      answer: string;
      tryoutSetId: string;
      optionId: string;
      tryoutQuestionId: string;
      isFlagged: boolean;
      filledAnswers: string[];
    }[];
    if (questionAttempt) {
      // have answered or flagged question before. Update question attempt
      if (question.type !== 'multiple-choice') {
        updatedAttempts = await this.db
          .update(schema.tryout_question_attempts)
          .set({
            answer: null,
            filledAnswers: filled_answers,
          })
          .where(eq(schema.tryout_question_attempts.id, questionAttempt.id))
          .returning();
      } else {
        // MCQ
        // check if question object is string
        if (typeof question.options === 'string') {
          question.options = JSON.parse(question.options);
        }

        const selectedOption = question.options.find(
          (option) => option.id == answer,
        );
        if (!selectedOption) {
          console.error('Selected option not found', question.options, answer);
        }
        updatedAttempts = await this.db
          .update(schema.tryout_question_attempts)
          .set({
            answer: selectedOption.content,
            filledAnswers: null,
            optionId: selectedOption.id,
          })
          .where(eq(schema.tryout_question_attempts.id, questionAttempt.id))
          .returning();
      }
    } else {
      // new answer. Create question attempt
      if (question.type !== 'multiple-choice') {
        const value = {
          tryoutId: tryoutId,
          tryoutSetId: question.tryoutSetId,
          tryoutQuestionId: questionId,
          userId: userId,
          answer: null,
          filledAnswers: filled_answers,
        };

        updatedAttempts = await this.db
          .insert(schema.tryout_question_attempts)
          .values(value)
          .onConflictDoUpdate({
            target: [
              schema.tryout_question_attempts.tryoutSetId,
              schema.tryout_question_attempts.userId,
              schema.tryout_question_attempts.tryoutQuestionId,
            ],
            set: value,
          })
          .returning();
      } else {
        // MCQ
        // check if question object is string
        if (typeof question.options === 'string') {
          question.options = JSON.parse(question.options);
        }

        const selectedOption = question.options.find(
          (option) => option.id == answer,
        );

        if (!selectedOption) {
          console.error('Selected option not found', question.options, answer);
        }
        const val = {
          tryoutId: tryoutId,
          tryoutSetId: question.tryoutSetId,
          tryoutQuestionId: questionId,
          userId: userId,
          answer: selectedOption?.content,
          filledAnswers: null,
          optionId: selectedOption?.id,
        };

        updatedAttempts = await this.db
          .insert(schema.tryout_question_attempts)
          .values(val)
          .onConflictDoUpdate({
            target: [
              schema.tryout_question_attempts.tryoutSetId,
              schema.tryout_question_attempts.userId,
              schema.tryout_question_attempts.tryoutQuestionId,
            ],
            set: val,
          })
          .returning();
      }
    }

    // check if options object is string
    if (typeof question.options === 'string') {
      question.options = JSON.parse(question.options);
    }

    let formattedOptions = [];

    // hide correct answer
    if (question.type !== 'fill-in') {
      formattedOptions = question.options.map((option) => {
        const { is_true, ...other } = option;
        return other;
      });
    }

    return {
      id: questionId,
      content: question.content,
      options: formattedOptions,
      is_text_answer: question.isTextAnswer,
      answer: questionAttempt?.id,
      filled_answers: updatedAttempts[0].filledAnswers,
      option_id: updatedAttempts[0].optionId,
      is_flagged: updatedAttempts[0].isFlagged,
    };
  }

  async toggleQuestionFlag(setId: string, userId: string, questionId: string) {
    // check if user has attempted the set
    const setAttempts = await this.db
      .select({
        id: schema.tryout_set_attempts.id,
        started_at: schema.tryout_set_attempts.startedAt,
        submitted_at: schema.tryout_set_attempts.submittedAt,
        duration: schema.tryout_sets.duration,
        tryout_id: schema.tryout_sets.tryoutId,
      })
      .from(schema.tryout_set_attempts)
      .where(
        and(
          eq(schema.tryout_set_attempts.tryoutSetId, setId),
          eq(schema.tryout_set_attempts.userId, userId),
        ),
      )
      .innerJoin(
        schema.tryout_sets,
        eq(schema.tryout_set_attempts.tryoutSetId, schema.tryout_sets.id),
      )
      .limit(1);

    if (!setAttempts.length)
      throw new UnauthorizedException(`Please start the tryout set first`);

    // check if user already submitted the set
    const setAttempt = setAttempts[0];
    if (setAttempt.submitted_at)
      throw new BadRequestException(
        `You have finished this set, thus can't change any of your answer`,
      );

    const tryoutId = setAttempt.tryout_id;
    // check if question exists in set
    const questionQuery = await this.db
      .select()
      .from(schema.tryout_questions)
      .where(
        and(
          eq(schema.tryout_questions.id, questionId),
          eq(schema.tryout_questions.tryoutSetId, setId),
        ),
      )
      .limit(1);

    if (!questionQuery.length)
      throw new NotFoundException(`Question not found in tryout set`);

    const question = questionQuery[0];

    // Store isFlagged in question attempt
    let updatedAttempts: {
      id: string;
      tryoutId: string;
      userId: string;
      answer: string;
      tryoutSetId: string;
      optionId: string;
      tryoutQuestionId: string;
      isFlagged: boolean;
    }[];

    const questionAttempt =
      await this.db.query.tryout_question_attempts.findFirst({
        where: and(
          eq(schema.tryout_question_attempts.tryoutQuestionId, questionId),
          eq(schema.tryout_question_attempts.userId, userId),
        ),
      });

    if (questionAttempt) {
      // negates the current value of isFlagged
      updatedAttempts = await this.db
        .update(schema.tryout_question_attempts)
        .set({ isFlagged: !questionAttempt.isFlagged })
        .where(eq(schema.tryout_question_attempts.id, questionAttempt.id))
        .returning();
    } else {
      // create new question attempt with isFlagged set to false
      updatedAttempts = await this.db
        .insert(schema.tryout_question_attempts)
        .values({
          tryoutId: tryoutId,
          tryoutSetId: question.tryoutSetId,
          tryoutQuestionId: questionId,
          userId: userId,
          isFlagged: true,
        })
        .returning();
    }

    return {
      question_id: questionId,
      is_flagged: updatedAttempts[0].isFlagged,
    };
  }

  async startTryout(tryoutId: string, userId: string, eventCode?: string) {
    const tryout = await this.db.query.tryouts.findFirst({
      where: and(
        eq(schema.tryouts.id, tryoutId),
        gt(schema.tryouts.expiryDate, new Date()),
      ),
    });
    if (!tryout) throw new NotFoundException('Tryout not found');

    // check if user has attempted the tryout before
    const existingTryoutAttempts = await this.db
      .select({
        id: schema.tryout_attempts.id,
        started_at: schema.tryout_attempts.startedAt,
      })
      .from(schema.tryout_attempts)
      .where(
        and(
          eq(schema.tryout_attempts.userId, userId),
          eq(schema.tryout_attempts.tryoutId, tryoutId),
        ),
      );

    if (existingTryoutAttempts.length) {
      const tryoutState = await this.getCurrentTryoutState(userId);

      console.error(
        `Tryout attempt already exists \nuser_id:${userId}\ntryout_id:${tryoutId}\ntryout_attempt:${JSON.stringify(
          existingTryoutAttempts[0],
        )}\nTryoutState:${JSON.stringify(tryoutState)}`,
      );
      throw new BadRequestException(
        `You have attempted this tryout before on ${existingTryoutAttempts[0].started_at}`,
      );
    }

    const tryoutSetId = tryout.firstSetId;

    // get tryout set
    const tryoutSet = await this.db.query.tryout_sets.findFirst({
      where: eq(schema.tryout_sets.id, tryoutSetId),
    });

    if (!tryoutSet)
      throw new Error(
        `No first TO set is found in Tryout with id '${tryoutId}'`,
      );

    const firstSetId = tryoutSet.id;

    if (tryout.eventCode && tryout.eventCode !== eventCode) {
      throw new BadRequestException('Invalid event code');
    }

    const tryoutAttempt = await this.db
      .insert(schema.tryout_attempts)
      .values({
        tryoutId,
        userId,
        currentTryoutSetId: null,
        startedAt: new Date(),
      })
      .returning();

    if (!tryoutAttempt.length)
      throw new Error(`Failed to start a tryout with id '${tryoutId}'`);

    return {
      id: tryoutAttempt[0].id,
      tryout_id: tryoutAttempt[0].tryoutId,
      started_at: tryoutAttempt[0].startedAt,
      first_set_id: firstSetId,
    };
  }

  async startTryoutSet(tryoutId: string, userId: string, tryoutSetId: string) {
    this.logger.log(
      `Start TryoutSet with id ${tryoutSetId} for user ${userId}`,
    );
    // check if tryout exists
    const tryout = await this.db.query.tryouts.findFirst({
      where: eq(schema.tryouts.id, tryoutId),
    });
    if (!tryout) throw new Error('Tryout not found');
    if (tryout.expiryDate < new Date()) throw new Error('Tryout has expired');

    // check if user has attempted the tryout
    const tryoutAttempt = await this.db.query.tryout_attempts.findFirst({
      where: and(
        eq(schema.tryout_attempts.tryoutId, tryoutId),
        eq(schema.tryout_attempts.userId, userId),
      ),
    });
    if (!tryoutAttempt)
      throw new BadRequestException('You have not started the tryout');

    // check if user has exceed the total duration of tryout (sum of sets duration + buffer duration)
    const totalDuration = await this.getTryoutTotalDuration(tryoutId);
    if (
      dayjs().isAfter(
        dayjs(tryoutAttempt.startedAt).add(totalDuration, 'second'),
      ) &&
      !tryout.isWindow
    ) {
      this.logger.error('User has exceeded the tryout time limit');
      throw new BadRequestException('You have exceeded the tryout time limit');
    }

    // check if set existss
    const tryoutSets = await this.db
      .select()
      .from(schema.tryout_sets)
      .where(
        and(
          eq(schema.tryout_sets.id, tryoutSetId),
          eq(schema.tryout_sets.tryoutId, tryoutId),
        ),
      );
    if (!tryoutSets.length) throw new NotFoundException('Tryout set not found');
    const tryoutSet = tryoutSets[0];

    // TODO: check if previous set has been submmitted

    // check if user has attempted the same set before
    const tryoutSetAttempt = await this.db.query.tryout_set_attempts.findFirst({
      where: and(
        eq(schema.tryout_set_attempts.tryoutId, tryoutId),
        eq(schema.tryout_set_attempts.tryoutSetId, tryoutSetId),
        eq(schema.tryout_set_attempts.userId, userId),
      ),
    });

    if (tryoutSetAttempt) {
      this.logger.error(
        `Tryout set attempt already exists, tryoutId: ${tryoutId}, tryoutSetId: ${tryoutSetId}, userId: ${userId}, tryoutAttempt: ${tryoutAttempt}`,
      );

      if (tryoutAttempt.submittedAt) {
        // get the next set
        const nextTryoutSets = await this.db
          .select()
          .from(schema.tryout_sets)
          .where(
            and(
              eq(schema.tryout_sets.tryoutId, tryoutId),
              gt(
                schema.tryout_sets.createdAt,
                dayjs(tryoutSet.createdAt).add(1, 'second').toDate(),
              ),
            ),
          )
          .orderBy(asc(schema.tryout_sets.createdAt))
          .limit(1);

        // get the first question
        const firstQuestion = await this.db.query.tryout_questions.findFirst({
          where: eq(schema.tryout_questions.tryoutSetId, nextTryoutSets[0].id),
        });

        const createdSetAttempt = await this.db
          .insert(schema.tryout_set_attempts)
          .values({
            tryoutId,
            userId,
            tryoutSetId: nextTryoutSets[0].id,
            currentQuestionId: firstQuestion.id,
          })
          .returning();

        if (!createdSetAttempt.length) {
          this.logger.error(
            `Failed to start tryout set with id '${tryoutSetId} and next set id '${nextTryoutSets[0].id}' for user ${userId}`,
          );
          throw new Error(
            `Failed to start tryout set with id '${tryoutSetId} and next set id '${nextTryoutSets[0].id}'`,
          );
        }

        // update tryout state
        await this.db
          .update(schema.tryout_attempts)
          .set({
            currentTryoutSetId: nextTryoutSets[0].id,
          })
          .where(
            and(
              eq(schema.tryout_attempts.id, tryoutAttempt.id),
              eq(schema.tryout_attempts.userId, userId),
            ),
          )
          .execute();

        return {
          id: createdSetAttempt[0].id,
          tryout_id: createdSetAttempt[0].tryoutId,
          set_id: createdSetAttempt[0].tryoutSetId,
          started_at: createdSetAttempt[0].startedAt,
        };
      }
    }

    // get first question in set
    const firstQuestion = await this.db.query.tryout_questions.findFirst({
      where: eq(schema.tryout_questions.tryoutSetId, tryoutSetId),
      orderBy: asc(schema.tryout_questions.createdAt),
    });

    let createdSetAttempt = await this.db
      .insert(schema.tryout_set_attempts)
      .values({
        tryoutId,
        userId,
        tryoutSetId,
        currentQuestionId: firstQuestion.id,
      })
      .onConflictDoNothing()
      .returning();

    // if already created just return the created set attempt
    if (!createdSetAttempt.length) {
      createdSetAttempt = await this.db
        .select()
        .from(schema.tryout_set_attempts)
        .where(
          and(
            eq(schema.tryout_set_attempts.tryoutSetId, tryoutSetId),
            eq(schema.tryout_set_attempts.userId, userId),
          ),
        );
    }

    await this.db
      .update(schema.tryout_attempts)
      .set({
        currentTryoutSetId: createdSetAttempt[0].tryoutSetId,
      })
      .where(
        and(
          eq(schema.tryout_attempts.id, tryoutAttempt.id),
          eq(schema.tryout_attempts.userId, userId),
        ),
      )
      .execute();

    if (!createdSetAttempt.length)
      throw new BadRequestException(
        `Failed to start tryout set with id '${tryoutSetId}'`,
      );

    this.logger.log(
      `Successfully started TryoutSet with id ${tryoutSetId} for user ${userId}`,
    );

    return {
      id: createdSetAttempt[0].id,
      tryout_id: createdSetAttempt[0].tryoutId,
      set_id: createdSetAttempt[0].tryoutSetId,
      started_at: createdSetAttempt[0].startedAt,
    };
  }

  /**
   * get all tryout sets -> sum all sets duration -> add tryout buffer duration -> return total duration
   * @param tryoutId
   * @returns
   */
  async getTryoutTotalDuration(tryoutId: string) {
    const tryout = await this.db.query.tryouts.findFirst({
      where: eq(schema.tryouts.id, tryoutId),
    });

    if (!tryout) throw new Error('Tryout not found');

    const tryoutSets = await this.db.query.tryout_sets.findMany({
      where: eq(schema.tryout_sets.tryoutId, tryoutId),
    });

    const totalDuration = tryoutSets.reduce((acc, curr) => {
      return acc + curr.duration;
    }, 0);

    return totalDuration + tryout.bufferDuration;
  }

  async submitTryoutSet(tryoutSetId: string, userId: string) {
    // check if set attempt exists
    const tryoutSetAttempt = await this.db.query.tryout_set_attempts.findFirst({
      where: and(
        eq(schema.tryout_set_attempts.tryoutSetId, tryoutSetId),
        eq(schema.tryout_set_attempts.userId, userId),
      ),
    });
    if (!tryoutSetAttempt)
      throw new BadRequestException(`You have not started this set`);
    const tryoutId = tryoutSetAttempt.tryoutId;

    // check if already submitted (submitted_at is not null)
    if (tryoutSetAttempt.submittedAt) {
      this.logger.error(
        `Tryout set attempt already submitted, tryoutId: ${tryoutId}, tryoutSetId: ${tryoutSetId}, userId: ${userId}, TryoutState: ${JSON.stringify(
          await this.getCurrentTryoutState(userId),
        )}`,
      );
      return 'Already submitted';
    }
    // find submitted at value
    const tryoutSet = await this.db.query.tryout_sets.findFirst({
      where: eq(schema.tryout_sets.id, tryoutSetId),
    });

    if (!tryoutSet) throw new Error(`Set not found, but set attempt exists`);
    const setTimeLimit = dayjs(tryoutSetAttempt.startedAt).add(
      tryoutSet.duration,
      'second',
    );

    const tryoutTimeLimit = dayjs(
      await this.getTryoutTimeLimitOfUser(tryoutId, userId),
    );
    const timeLimit = tryoutTimeLimit.isBefore(setTimeLimit)
      ? tryoutTimeLimit
      : setTimeLimit;

    const now = dayjs();
    const submittedAt = timeLimit.isBefore(now)
      ? timeLimit.toDate()
      : now.toDate();

    const updatedSetAttempts = await this.db
      .update(schema.tryout_set_attempts)
      .set({ submittedAt })
      .where(
        and(
          eq(schema.tryout_set_attempts.id, tryoutSetAttempt.id),
          eq(schema.tryout_set_attempts.userId, userId),
        ),
      )
      .returning();
    const updatedSetAttempt = updatedSetAttempts[0];
    const nextTryoutSets = await this.db
      .select()
      .from(schema.tryout_sets)
      .where(
        and(
          eq(schema.tryout_sets.tryoutId, tryoutId),
          eq(schema.tryout_sets.id, tryoutSet.nextSet),
        ),
      )
      .orderBy(asc(schema.tryout_sets.createdAt))
      .limit(1);

    const nextSetId: string | null = nextTryoutSets.length
      ? nextTryoutSets[0].id
      : null;

    await this.db
      .update(schema.tryout_attempts)
      .set({
        currentTryoutSetId: nextSetId,
      })
      .where(
        and(
          eq(schema.tryout_attempts.tryoutId, tryoutId),
          eq(schema.tryout_attempts.userId, userId),
        ),
      );

    return {
      id: updatedSetAttempt.id,
      tryout_id: updatedSetAttempt.tryoutId,
      set_id: updatedSetAttempt.tryoutSetId,
      started_at: updatedSetAttempt.startedAt,
      submitted_at: updatedSetAttempt.submittedAt,
      next_set_id: nextSetId,
      next_set_duration: nextTryoutSets.length
        ? nextTryoutSets[0].duration
        : null,
    };
  }

  /**
   * Get time limit of tryout from started_at + total tryout duration (sets + buffer), or expiry date
   * @param tryoutId
   * @param userId
   * @returns
   */
  async getTryoutTimeLimitOfUser(tryoutId: string, userId: string) {
    const tryout = await this.db.query.tryouts.findFirst({
      where: eq(schema.tryouts.id, tryoutId),
    });
    if (!tryout) throw new Error(`Tryout not found`);

    const tryoutAttempt = await this.db.query.tryout_attempts.findFirst({
      where: and(
        eq(schema.tryout_attempts.tryoutId, tryoutId),
        eq(schema.tryout_attempts.userId, userId),
      ),
    });
    if (!tryoutAttempt) throw new Error(`Tryout attempt not found`);

    const tryoutTotalDuration = await this.getTryoutTotalDuration(tryoutId);
    const tryoutTimeLimit = dayjs(tryoutAttempt.startedAt).add(
      tryoutTotalDuration,
      'second',
    );

    if (tryoutTimeLimit.isAfter(tryout.expiryDate)) {
      return tryout.expiryDate;
    }
    return tryoutTimeLimit.toDate();
  }

  async setAttemptCurrentQuestion(
    setId: string,
    userId: string,
    currentQuestion: string,
  ) {
    // check if user has attempted the set
    const setAndAttempt = await this.db
      .select()
      .from(schema.tryout_sets)
      .where(eq(schema.tryout_sets.id, setId))
      .leftJoin(
        schema.tryout_set_attempts,
        and(
          eq(schema.tryout_set_attempts.tryoutSetId, schema.tryout_sets.id),
          eq(schema.tryout_set_attempts.userId, userId),
        ),
      )
      .limit(1);

    if (!setAndAttempt.length)
      throw new NotFoundException(`Tryout set is not found`);

    const setAttempt = setAndAttempt[0].tryout_set_attempts;

    if (!setAttempt)
      throw new BadRequestException(`You have not started this set`);

    // check if question exists in set
    const question = await this.db.query.tryout_questions.findFirst({
      where: eq(schema.tryout_questions.id, currentQuestion),
    });
    if (!question)
      throw new NotFoundException(`Question not found in tryout set`);

    // check if the to set still has time
    const tryoutId = setAndAttempt[0].tryout_sets.tryoutId;
    const tryoutTimeLimit = dayjs(
      await this.getTryoutTimeLimitOfUser(tryoutId, userId),
    );

    const tryoutSet = await this.db.query.tryout_sets.findFirst({
      where: eq(schema.tryout_sets.id, setId),
    });

    const setTimeLimit = dayjs(setAttempt.startedAt).add(
      tryoutSet.duration,
      'second',
    );

    const timeLimit = tryoutTimeLimit.isBefore(setTimeLimit)
      ? tryoutTimeLimit
      : setTimeLimit;

    if (dayjs().isAfter(timeLimit)) {
      const tryout = await this.db.query.tryouts.findFirst({
        where: eq(schema.tryouts.id, tryoutId),
        columns: {
          isWindow: true,
        },
      });
      if (!tryout.isWindow) {
        this.logger.error(
          `Failed to change currentQuestion attempt for set ${tryoutSet.id}. User ${userId} has exceeded the set time limit`,
        );
        throw new BadRequestException(`You have exceeded the time limit`);
      }
    }

    // update current question in set attempt
    const updatedSetAttempts = await this.db
      .update(schema.tryout_set_attempts)
      .set({ currentQuestionId: currentQuestion })
      .where(
        and(
          eq(schema.tryout_set_attempts.tryoutSetId, setId),
          eq(schema.tryout_set_attempts.userId, userId),
        ),
      )
      .returning();

    if (!updatedSetAttempts.length)
      throw new Error(`Failed to update current question in set attempt`);

    return {
      id: setId,
      current_question_id: updatedSetAttempts[0].currentQuestionId,
    };
  }

  async submitTryout(tryoutId: string, userId: string) {
    // check if to attempt exists
    const tryoutsAndAttempts = await this.db
      .select()
      .from(schema.tryouts)
      .where(eq(schema.tryouts.id, tryoutId))
      .innerJoin(
        schema.tryout_attempts,
        and(
          eq(schema.tryouts.id, schema.tryout_attempts.tryoutId),
          eq(schema.tryout_attempts.userId, userId),
        ),
      )
      .limit(1);

    if (!tryoutsAndAttempts.length)
      throw new NotFoundException('Tryout or attempt not found');

    const tryout = tryoutsAndAttempts[0].tryouts;
    const tryoutAttempt = tryoutsAndAttempts[0].tryout_attempts;
    if (tryoutAttempt.submittedAt) {
      this.logger.error(
        `Tryout attempt already submitted, tryoutId: ${tryoutId}, userId: ${userId}, TryoutState: ${JSON.stringify(
          await this.getCurrentTryoutState(userId),
        )}`,
      );
      return 'Already Submitted';
    }

    const tryoutTotalDuration = await this.getTryoutTotalDuration(tryoutId);
    let tryoutTimeLimit = dayjs(tryoutAttempt.startedAt).add(
      tryoutTotalDuration,
      'second',
    );
    if (tryoutTimeLimit.isAfter(tryout.expiryDate)) {
      tryoutTimeLimit = dayjs(tryout.expiryDate);
    }

    let submittedAt: Date;
    if (tryoutTimeLimit.isBefore(dayjs()) && !tryout.isWindow) {
      // user has exceeded time limit
      submittedAt = tryoutTimeLimit.toDate();
    } else {
      // user wants to submit tryout before the time is up
      const tryoutSets = await this.db
        .select()
        .from(schema.tryout_sets)
        .where(eq(schema.tryout_sets.tryoutId, tryoutId))
        .leftJoin(
          schema.tryout_set_attempts,
          and(
            eq(schema.tryout_set_attempts.tryoutSetId, schema.tryout_sets.id),
            eq(schema.tryout_set_attempts.userId, userId),
          ),
        );

      // check if all sets have been submitted
      const unfinishedSetExist = tryoutSets.some((setAndAttempt) => {
        const attempt = setAndAttempt.tryout_set_attempts;
        return !attempt || !attempt.submittedAt;
      });
      if (unfinishedSetExist)
        throw new BadRequestException(
          `Please submit all sets in this tryout first`,
        );

      submittedAt = new Date();
    }

    const updatedTryoutAttempts = await this.db
      .update(schema.tryout_attempts)
      .set({ submittedAt: submittedAt })
      .where(
        and(
          eq(schema.tryout_attempts.tryoutId, tryoutId),
          eq(schema.tryout_attempts.userId, userId),
        ),
      )
      .returning({
        id: schema.tryout_attempts.id,
        tryout_id: schema.tryout_attempts.tryoutId,
        started_at: schema.tryout_attempts.startedAt,
        submitted_at: schema.tryout_attempts.submittedAt,
      });
    if (!updatedTryoutAttempts.length)
      throw new Error(`Failed to submit tryout attempt`);

    return updatedTryoutAttempts[0];
  }

  async getRegisteredTryouts(userId: string) {
    const res: string[] = [];
    const user = await this.db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    const isUserSubscribed = dayjs(user.validity_date).isAfter(dayjs());

    if (isUserSubscribed) {
      const tryouts = await this.db.query.tryouts.findMany({
        where: or(
          gt(schema.tryouts.expiryDate, new Date()),
          schema.tryouts.isWindow,
        ),
      });

      tryouts.map(({ id }) => {
        res.push(id);
      });
    } else {
      const tryouts = await this.db
        .select()
        .from(schema.tryout_registrations)
        .where(eq(schema.tryout_registrations.user_id, userId));

      tryouts.map(({ tryout_id }) => {
        res.push(tryout_id);
      });
    }

    return res;
  }

  async getTryoutSetSequence(tryoutId: string) {
    const res = [];

    const tryout = await this.db.query.tryouts.findFirst({
      where: eq(schema.tryouts.id, tryoutId),
    });

    // get first to set
    let currentSet = await this.db.query.tryout_sets.findFirst({
      where: eq(schema.tryout_sets.id, tryout.firstSetId),
    });

    if (!currentSet) {
      console.error('First set not found', tryout);
      throw new Error('First set not found');
    }

    // get the subject
    const firstSetSubject = await this.db.query.tryout_subjects.findFirst({
      where: eq(schema.tryout_subjects.id, currentSet.subjectId),
    });

    res.push({
      id: currentSet.id,
      name: firstSetSubject.name,
    });

    while (true) {
      if (currentSet.nextSet) {
        currentSet = await this.db.query.tryout_sets.findFirst({
          where: eq(schema.tryout_sets.id, currentSet.nextSet),
        });

        if (!currentSet) {
          console.error('Next set not found', tryout);
          throw new Error('Next set not found');
        }

        // get the subject
        const toSetSubject = await this.db.query.tryout_subjects.findFirst({
          where: eq(schema.tryout_subjects.id, currentSet.subjectId),
        });

        res.push({
          id: currentSet.id,
          name: toSetSubject.name,
        });
      } else {
        break;
      }
    }

    return res;
  }
}

export default TryoutService;
