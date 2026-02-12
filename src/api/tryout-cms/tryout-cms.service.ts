import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DrizzleAsyncProvider } from 'src/database/drizzle/drizzle.provider';
import * as schema from 'src/database/schema';
import {
  CreateSubjectDto,
  CreateTryoutDto,
  CreateTryoutQuestionDto,
  CreateTryoutSetDto,
  UpdateTryoutDto,
  UpdateTryoutQuestionDto,
} from './tryout-cms.dto';
import {
  and,
  eq,
  not,
  inArray,
  sql,
  asc,
  desc,
  isNotNull,
  ne,
} from 'drizzle-orm';
import { v4 } from 'uuid';
import { TRYOUT_SUBJECT_TIME_MAPPING } from './tryout-cms.data';
import * as dayjs from 'dayjs';
import TryoutWorkerService from 'src/workers/tryout/tryout.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OnModuleInit } from '@nestjs/common';

@Injectable()
class TryoutCMSService implements OnModuleInit {
  private supabase: SupabaseClient;

  onModuleInit() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.SUPABASE_KEY || 'placeholder-key',
    );
  }
  constructor(
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
    private tryoutWorkerService: TryoutWorkerService,
  ) {}

  async createTryout(data: CreateTryoutDto) {
    const tryout = await this.db
      .insert(schema.tryouts)
      .values({
        description: data.description,
        isIrt: data.is_irt,
        label: data.label,
        name: data.name,
        expiryDate: new Date(data.expiry_date),
        logoSrc: data.logo_src,
        correctBasePoint: data.correct_base_point,
        wrongBasePoint: data.wrong_base_point,
        bufferDuration: data.buffer_duration,
        isKilat: data.is_kilat,
        isWindow: data.is_window,
      })
      .returning();
    return tryout[0];
  }

  async createTryoutSet(data: CreateTryoutSetDto) {
    const tryoutSubject = await this.db.query.tryout_subjects.findFirst({
      where: eq(schema.tryout_subjects.id, data.subject_id),
    });

    if (!tryoutSubject) {
      throw new NotFoundException('Tryout subject not found');
    }

    const isTryoutSetWithSubjectExists =
      await this.db.query.tryout_sets.findFirst({
        where: and(
          eq(schema.tryout_sets.tryoutId, data.tryout_id),
          eq(schema.tryout_sets.subjectId, data.subject_id),
        ),
      });

    if (isTryoutSetWithSubjectExists) {
      throw new Error('Tryout set with subject already exists');
    }

    const duration =
      tryoutSubject.questionsLimit * (tryoutSubject.questionDuration || 60) ||
      10 * 60;

    if (!duration) {
      throw new Error('Tryout subject not found in time mapping');
    }

    const tryoutSet = await this.db
      .insert(schema.tryout_sets)
      .values({
        duration: duration,
        subjectId: data.subject_id,
        tryoutId: data.tryout_id,
      })
      .returning();

    return tryoutSet[0];
  }

  async getTryoutSetByTryoutId(tryoutId: string) {
    const tryoutSets = await this.db
      .select({
        id: schema.tryout_sets.id,
        duration: schema.tryout_sets.duration,
        subject_name: schema.tryout_subjects.name,
        question_count: schema.tryout_subjects.questionsLimit,
      })
      .from(schema.tryout_sets)
      .leftJoin(
        schema.tryout_subjects,
        eq(schema.tryout_sets.subjectId, schema.tryout_subjects.id),
      )
      .where(eq(schema.tryout_sets.tryoutId, tryoutId));

    // sum all duration
    let totalDuration = 0;
    for (let i = 0; i < tryoutSets.length; i++) {
      totalDuration += tryoutSets[i].duration;
    }

    return {
      sets: tryoutSets,
      totalDuration,
    };
  }

  async getSortedTryoutSetByTryoutId(tryoutId: string) {
    const tryoutSets = await this.db
      .select({
        id: schema.tryout_sets.id,
        duration: schema.tryout_sets.duration,
        subject_name: schema.tryout_subjects.name,
        question_count: schema.tryout_subjects.questionsLimit,
        order: schema.tryout_sets.order,
        nextSet: schema.tryout_sets.nextSet,
      })
      .from(schema.tryout_sets)
      .leftJoin(
        schema.tryout_subjects,
        eq(schema.tryout_sets.subjectId, schema.tryout_subjects.id),
      )
      .where(eq(schema.tryout_sets.tryoutId, tryoutId))
      .orderBy(asc(schema.tryout_sets.order));

    let resetOrder = false;
    for (let i = 0; i < tryoutSets.length; i++) {
      if (tryoutSets[i].order === null) {
        resetOrder = true;
        break;
      }
      if (
        i < tryoutSets.length - 1 &&
        tryoutSets[i].nextSet !== tryoutSets[i + 1].id
      ) {
        resetOrder = true;
        break;
      }
      if (i === tryoutSets.length - 1 && tryoutSets[i].nextSet !== null) {
        resetOrder = true;
        break;
      }
    }

    if (resetOrder) {
      for (let i = 0; i < tryoutSets.length; i++) {
        await this.db
          .update(schema.tryout_sets)
          .set({
            order: i + 1,
            nextSet: i === tryoutSets.length - 1 ? null : tryoutSets[i + 1].id,
          })
          .where(eq(schema.tryout_sets.id, tryoutSets[i].id));
      }
      tryoutSets.forEach((set, index) => {
        set.order = index + 1;
        set.nextSet =
          index === tryoutSets.length - 1 ? null : tryoutSets[index + 1].id;
      });

      const firstSet = tryoutSets[0];

      await this.db
        .update(schema.tryouts)
        .set({
          firstSetId: firstSet.id,
        })
        .where(eq(schema.tryouts.id, tryoutId));
    }

    // sort tryout sets
    const sortedTryoutSets = tryoutSets.sort((a, b) => {
      return a.order - b.order;
    });

    // sum all duration
    let totalDuration = 0;
    for (let i = 0; i < sortedTryoutSets.length; i++) {
      totalDuration += sortedTryoutSets[i]?.duration;
    }

    return {
      sets: sortedTryoutSets,
      totalDuration,
    };
  }

  async swapTryoutSetOrder(tryoutSetId1: string, tryoutSetId2: string) {
    const tryoutSet1 = await this.db.query.tryout_sets.findFirst({
      where: eq(schema.tryout_sets.id, tryoutSetId1),
    });

    if (!tryoutSet1) {
      throw new NotFoundException('Tryout set not found');
    }

    const tryoutSet2 = await this.db.query.tryout_sets.findFirst({
      where: eq(schema.tryout_sets.id, tryoutSetId2),
    });

    if (!tryoutSet2) {
      throw new NotFoundException('Tryout set not found');
    }
    // Make sure to do this first in the database
    // ```sql
    // CREATE OR REPLACE FUNCTION swap_tryout_sets_order(id1 uuid, id2 uuid)
    // RETURNS VOID AS $$
    // DECLARE
    //   order1 INTEGER;
    //   order2 INTEGER;
    // BEGIN
    //   SELECT "order" INTO order1 FROM tryout_sets WHERE id = id1;
    //   SELECT "order" INTO order2 FROM tryout_sets WHERE id = id2;

    //   BEGIN
    //     UPDATE tryout_sets SET "order" = order2 WHERE id = id1;
    //     UPDATE tryout_sets SET "order" = order1 WHERE id = id2;
    //   END;
    // END;
    // $$ LANGUAGE plpgsql;
    // ```

    const res = await this.supabase.rpc('swap_tryout_sets_order', {
      id1: tryoutSetId1,
      id2: tryoutSetId2,
    });

    return true;
  }

  async getTryoutTimeLimit(tryoutId: string) {
    // get all tryout sets -> sum all duration -> sum with buffer duration -> return total duration

    const tryoutSets = await this.db.query.tryout_sets.findMany({
      where: eq(schema.tryout_sets.tryoutId, tryoutId),
    });

    const totalDuration = tryoutSets.reduce((acc, curr) => {
      return acc + curr.duration;
    }, 0);

    const tryout = await this.db.query.tryouts.findFirst({
      where: eq(schema.tryouts.id, tryoutId),
    });

    if (!tryout) {
      throw new Error('Tryout not found');
    }

    return totalDuration + tryout.bufferDuration;
  }

  async getAllTryout(labels: string) {
    const selectedLabels = labels ? labels.split(',') : null;
    const tryout = await (labels
      ? this.db
          .select()
          .from(schema.tryouts)
          .where(
            labels !== 'all' && inArray(schema.tryouts.label, selectedLabels),
          )
          .orderBy(desc(schema.tryouts.createdAt))
      : this.db
          .select()
          .from(schema.tryouts)
          .orderBy(desc(schema.tryouts.createdAt)));

    if (!tryout.length) {
      return [];
    }

    let tryoutIds = tryout.map((t) => t.id);

    tryoutIds = tryoutIds.length > 0 ? tryoutIds : [''];

    const tryoutSets = await this.db
      .select({
        id: schema.tryout_sets.id,
        duration: schema.tryout_sets.duration,
        tryoutId: schema.tryout_sets.tryoutId,
        subject_name: schema.tryout_subjects.name,
        question_count: schema.tryout_subjects.questionsLimit,
      })
      .from(schema.tryout_sets)
      .leftJoin(
        schema.tryout_subjects,
        eq(schema.tryout_sets.subjectId, schema.tryout_subjects.id),
      )
      .where(inArray(schema.tryout_sets.tryoutId, tryoutIds));

    const res = [];

    const tryoutSetMapping = {};

    tryoutSets.forEach((set) => {
      if (!tryoutSetMapping[set.tryoutId]) {
        tryoutSetMapping[set.tryoutId] = [];
      }

      tryoutSetMapping[set.tryoutId].push(set);
      delete set.tryoutId;
    });

    tryout.forEach((t) => {
      res.push({
        id: t.id,
        name: t.name,
        label: t.label,
        description: t.description,
        logo_src: t.logoSrc,
        is_irt: t.isIrt,
        expiry_date: t.expiryDate,
        correct_base_point: t.correctBasePoint,
        wrong_base_point: t.wrongBasePoint,
        buffer_duration: t.bufferDuration,
        sets: tryoutSetMapping[t.id] || [],
        is_published: t.isPublished,
        firstSetId: t.firstSetId,
        is_window: t.isWindow,
      });
    });

    for (let i = 0; i < res.length; i++) {
      const totalDuration = res[i].sets.reduce((acc, curr) => {
        return acc + curr.duration;
      }, 0);

      res[i].sets_duration = totalDuration;
      res[i].total_duration = totalDuration + res[i].buffer_duration;
    }

    return res;
  }

  async getAllTryoutLabels() {
    const labels = await this.db
      .selectDistinct({
        label: schema.tryouts.label,
      })
      .from(schema.tryouts)
      .where(
        and(isNotNull(schema.tryouts.label), not(eq(schema.tryouts.label, ''))),
      );

    const res = labels.map((l) => l.label);

    return res;
  }

  async getAllTryoutSubjects() {
    const tryoutSubjects = await this.db.query.tryout_subjects.findMany({
      columns: {
        id: true,
        name: true,
        questionsLimit: true,
        questionDuration: true,
      },
    });

    const res = tryoutSubjects.map((subject) => {
      return {
        id: subject.id,
        name: subject.name,
        questions_limit: subject.questionsLimit,
        time_limit: subject.questionsLimit * (subject.questionDuration || 60),
      };
    });

    return res;
  }

  async createTryoutSubject(data: CreateSubjectDto) {
    const subject = await this.db
      .insert(schema.tryout_subjects)
      .values({
        name: data.name,
        questionsLimit: data.question_limit,
      })
      .returning();

    const subjectId = subject[0].id;

    const isTryoutSetWithSubjectExists =
      await this.db.query.tryout_sets.findFirst({
        where: and(
          eq(schema.tryout_sets.tryoutId, data.tryout_id),
          eq(schema.tryout_sets.subjectId, subjectId),
        ),
      });

    if (isTryoutSetWithSubjectExists) {
      throw new NotFoundException('Tryout set with subject already exists');
    }

    const duration = TRYOUT_SUBJECT_TIME_MAPPING[data.name] || 10 * 60;

    if (!duration) {
      throw new NotFoundException('Tryout subject not found in time mapping');
    }

    const tryoutSet = await this.db
      .insert(schema.tryout_sets)
      .values({
        duration: duration,
        subjectId: subjectId,
        tryoutId: data.tryout_id,
      })
      .returning();

    return tryoutSet[0];
  }

  async getTryoutSetQuestionCounts() {
    const res = {};

    const tryoutQuestionSetCount = await this.db
      .select({
        tryout_set_id: schema.tryout_sets.id,
        count: sql<number>`cast(count(${schema.tryout_questions.id}) as int)`,
      })
      .from(schema.tryout_sets)
      .leftJoin(
        schema.tryout_questions,
        eq(schema.tryout_sets.id, schema.tryout_questions.tryoutSetId),
      )
      .groupBy(schema.tryout_sets.id);

    tryoutQuestionSetCount.forEach((t) => {
      res[t.tryout_set_id] = t.count;
    });

    return res;
  }

  async togglePublishTryout(tryoutId: string) {
    const tryout = await this.db.query.tryouts.findFirst({
      where: eq(schema.tryouts.id, tryoutId),
    });

    if (!tryout) {
      throw new Error('Tryout not found');
    }

    const isPublished = !tryout.isPublished;

    await this.db
      .update(schema.tryouts)
      .set({
        isPublished: isPublished,
      })
      .where(eq(schema.tryouts.id, tryoutId));

    const executeAt = dayjs(tryout.expiryDate).add(1, 'day').toDate();
    if (isPublished) {
      await this.tryoutWorkerService.addJob(executeAt, tryoutId);
    } else {
      await this.tryoutWorkerService.removeJob(executeAt, tryoutId);
    }

    return isPublished;
  }

  async getTryoutById(tryoutId: string) {
    const tryout = await this.db
      .select({
        id: schema.tryouts.id,
        name: schema.tryouts.name,
        expired_date: schema.tryouts.expiryDate,
        correct_base_point: schema.tryouts.correctBasePoint,
        wrong_base_point: schema.tryouts.wrongBasePoint,
        logo_src: schema.tryouts.logoSrc,
        description: schema.tryouts.description,
        is_irt: schema.tryouts.isIrt,
        label: schema.tryouts.label,
        created_at: schema.tryouts.createdAt,
        buffer_duration: schema.tryouts.bufferDuration,
        is_published: schema.tryouts.isPublished,
        is_window: schema.tryouts.isWindow,
      })
      .from(schema.tryouts)
      .where(eq(schema.tryouts.id, tryoutId));

    if (!tryout) {
      throw new NotFoundException('Tryout not found');
    }

    return tryout[0];
  }

  async updateTryout(tryoutId: string, data: UpdateTryoutDto) {
    const tryout = await this.db.query.tryouts.findFirst({
      where: eq(schema.tryouts.id, tryoutId),
    });

    if (!tryout) {
      throw new NotFoundException('Tryout not found');
    }

    const updatedTryout = await this.db
      .update(schema.tryouts)
      .set({
        description: data.description,
        isIrt: data.is_irt ?? tryout.isIrt,
        label: data.label ?? tryout.label,
        name: data.name ?? tryout.name,
        expiryDate: new Date(data.expiry_date ?? tryout.expiryDate),
        logoSrc: data.logo_src ?? tryout.logoSrc,
        correctBasePoint: data.correct_base_point ?? tryout.correctBasePoint,
        wrongBasePoint: data.wrong_base_point ?? tryout.wrongBasePoint,
        bufferDuration: data.buffer_duration ?? tryout.bufferDuration,
        isKilat: data.is_kilat ?? tryout.isKilat,
        isWindow: data.is_window ?? tryout.isWindow,
      })
      .where(eq(schema.tryouts.id, tryoutId));

    return updatedTryout;
  }

  async getTryoutQuestionsSet(tryoutSetId: string) {
    const tryoutSet = await this.db.query.tryout_sets.findFirst({
      where: eq(schema.tryout_sets.id, tryoutSetId),
    });

    if (!tryoutSet) {
      throw new NotFoundException('Tryout set not found');
    }

    const tryoutQuestions = await this.db.query.tryout_questions.findMany({
      where: eq(schema.tryout_questions.tryoutSetId, tryoutSetId),
    });

    return tryoutQuestions;
  }

  async createTryoutQuestions(
    tryoutSetId: string,
    createSoalTryoutDto: CreateTryoutQuestionDto,
  ) {
    const tryoutSet = await this.db.query.tryout_sets.findFirst({
      where: eq(schema.tryout_sets.id, tryoutSetId),
    });

    if (!tryoutSet) {
      throw new NotFoundException('Tryout set not found');
    }

    const tryoutSubject = await this.db.query.tryout_subjects.findFirst({
      where: eq(schema.tryout_subjects.id, tryoutSet.subjectId),
    });

    if (!tryoutSubject) {
      throw new NotFoundException('Tryout subject not found');
    }

    const questionLimit = tryoutSubject.questionsLimit;

    const tryoutQuestionsCount = await this.db
      .select({
        count: sql<number>`cast(count(${schema.tryout_questions.id}) as int)`,
      })
      .from(schema.tryout_questions)
      .where(eq(schema.tryout_questions.tryoutSetId, tryoutSetId));

    if (tryoutQuestionsCount[0].count >= questionLimit) {
      throw new Error('Tryout set question limit exceeded');
    }

    const options = createSoalTryoutDto.options.map((data) => {
      const generateId = v4();
      return {
        ...data,
        id: generateId,
      };
    });
    const tryoutQuestion = await this.db.transaction(async (trx) => {
      const tryoutQuestions = await trx
        .insert(schema.tryout_questions)
        .values({
          content: createSoalTryoutDto.question,
          contentImage: createSoalTryoutDto.question_image ?? '',
          tryoutSetId: tryoutSetId,
          isTextAnswer: !createSoalTryoutDto.is_mcq,
          options: options,
          questionId: createSoalTryoutDto.question_id,
          source: createSoalTryoutDto.source,
          type: createSoalTryoutDto.type,
          answers: createSoalTryoutDto.answers,
        })
        .returning({
          id: schema.tryout_questions.id,
          content: schema.tryout_questions.content,
          contentImage: schema.tryout_questions.contentImage,
          isTextAnswer: schema.tryout_questions.isTextAnswer,
          options: schema.tryout_questions.options,
          type: schema.tryout_questions.type,
        })
        .execute();

      await trx.insert(schema.tryout_pembahasan).values({
        content: createSoalTryoutDto.pembahasan,
        contentImage: createSoalTryoutDto.pembahasan_image ?? '',
        tryoutQuestionId: tryoutQuestions[0].id,
      });

      return tryoutQuestions[0];
    });

    return tryoutQuestion;
  }

  async updateTryoutQuestion(
    tryoutQuestionId: string,
    updateSoalTryoutDto: UpdateTryoutQuestionDto,
  ) {
    const tryoutQuestion = await this.db.query.tryout_questions.findFirst({
      where: eq(schema.tryout_questions.id, tryoutQuestionId),
    });

    if (!tryoutQuestion) {
      throw new NotFoundException('Tryout question not found');
    }

    const [updatedTryoutQuestions] = await this.db
      .update(schema.tryout_questions)
      .set({
        content: updateSoalTryoutDto.content ?? tryoutQuestion.content,
        contentImage: updateSoalTryoutDto.content_img ?? '',
        isTextAnswer: updateSoalTryoutDto.is_mcq ?? tryoutQuestion.isTextAnswer,
        options: updateSoalTryoutDto.options ?? tryoutQuestion.options,
        type: updateSoalTryoutDto.type ?? tryoutQuestion.type,
        answers: updateSoalTryoutDto.answers ?? tryoutQuestion.answers,
        explanations:
          updateSoalTryoutDto.explanations ?? tryoutQuestion.explanations,
      })
      .where(eq(schema.tryout_questions.id, tryoutQuestionId))
      .returning()
      .execute();

    return updatedTryoutQuestions;
  }

  async getTryoutQuestionBySetId(tryoutSetId: string) {
    const tryoutSet = await this.db.query.tryout_sets.findFirst({
      where: eq(schema.tryout_sets.id, tryoutSetId),
    });

    if (!tryoutSet) {
      throw new NotFoundException('Tryout set not found');
    }

    const tryoutQuestions = await this.db.query.tryout_questions.findMany({
      where: eq(schema.tryout_questions.tryoutSetId, tryoutSetId),
      orderBy: asc(schema.tryout_questions.createdAt), // order by created_at asc (oldest to newest)
      columns: {
        id: true,
      },
    });

    const maxQuestion = await this.db.query.tryout_subjects.findFirst({
      where: eq(schema.tryout_subjects.id, tryoutSet.subjectId),
      columns: {
        questionsLimit: true,
      },
    });

    return {
      questions: tryoutQuestions.map(({ id }) => id),
      max_question: maxQuestion.questionsLimit,
    };
  }

  async getTryoutQuestionById(tryoutQuestionId: string) {
    const tryoutQuestion = await this.db
      .select({
        id: schema.tryout_questions.id,
        content: schema.tryout_questions.content,
        content_img: schema.tryout_questions.contentImage,
        options: schema.tryout_questions.options,
        created_at: schema.tryout_questions.createdAt,
        explanations: schema.tryout_questions.explanations,
        type: schema.tryout_questions.type,
        answers: schema.tryout_questions.answers,
      })
      .from(schema.tryout_questions)
      .where(eq(schema.tryout_questions.id, tryoutQuestionId));

    const res = tryoutQuestion[0];

    if (!res) {
      throw new NotFoundException('Tryout question not found');
    }

    if (typeof res.options === 'string') {
      res.options = JSON.parse(res.options);
    }

    if (!tryoutQuestion) {
      throw new NotFoundException('Tryout question not found');
    }

    return res;
  }

  async getTryoutSetDetails(tryoutSetId: string) {
    const tryoutSet = await this.db
      .select()
      .from(schema.tryout_sets)
      .leftJoin(
        schema.tryout_subjects,
        eq(schema.tryout_sets.subjectId, schema.tryout_subjects.id),
      )
      .where(eq(schema.tryout_sets.id, tryoutSetId));

    if (!tryoutSet.length) {
      throw new NotFoundException('Tryout set not found');
    }

    const res = {
      id: tryoutSet[0].tryout_sets.id,
      duration: tryoutSet[0].tryout_sets.duration,
      subject_name: tryoutSet[0].tryout_subjects.name,
      question_count: tryoutSet[0].tryout_subjects.questionsLimit,
      generator_code: tryoutSet[0].tryout_subjects.generatorCode,
    };

    return res;
  }

  async getTryoutSetQuestionsCount(tryoutSetId: string) {
    const tryoutSet = await this.db.query.tryout_sets.findFirst({
      where: eq(schema.tryout_sets.id, tryoutSetId),
    });

    if (!tryoutSet) {
      throw new NotFoundException('Tryout set not found');
    }

    const q = await this.db
      .select({
        questionId: schema.tryout_questions.id,
        topicId: schema.questions.topic_id,
      })
      .from(schema.tryout_questions)
      .innerJoin(
        schema.questions,
        eq(schema.tryout_questions.questionId, schema.questions.id),
      )
      .where(eq(schema.tryout_questions.tryoutSetId, tryoutSetId))
      .execute();

    const topicIds = q.map(({ topicId }) => {
      return topicId;
    });

    if (!topicIds || topicIds.length === 0) {
      return {
        questions_count: [],
        max_question: 0,
        total_question: 0,
      };
    }

    const topic = await this.db.query.topics.findMany({
      where: inArray(schema.topics.id, topicIds),
      columns: {
        id: true,
        name: true,
      },
    });

    // get question limit
    const subject = await this.db.query.tryout_subjects.findFirst({
      where: eq(schema.tryout_subjects.id, tryoutSet.subjectId),
      columns: {
        questionsLimit: true,
      },
    });

    const res = topic.map((t) => {
      const count = q.filter(({ topicId }) => topicId === t.id).length;
      return {
        id: t.id,
        name: t.name,
        count: count,
      };
    });

    return {
      questions_count: res,
      max_question: subject.questionsLimit,
      total_question: q.length,
    };
  }

  async duplicateTryout(tryoutId: string, name: string) {
    // get the tryout by id
    const tryout = await this.db.query.tryouts.findFirst({
      where: eq(schema.tryouts.id, tryoutId),
    });

    if (!tryout) {
      throw new NotFoundException('Tryout not found');
    }

    const newTryout = await this.db.transaction(async (trx) => {
      const newTryout = await trx
        .insert(schema.tryouts)
        .values({
          description: tryout.description,
          isIrt: tryout.isIrt,
          label: tryout.label,
          name: name,
          expiryDate: tryout.expiryDate,
          logoSrc: tryout.logoSrc,
          correctBasePoint: tryout.correctBasePoint,
          wrongBasePoint: tryout.wrongBasePoint,
          bufferDuration: tryout.bufferDuration,
          isKilat: tryout.isKilat,
          isWindow: tryout.isWindow,
        })
        .returning();

      // get all tryout sets by tryout id

      const tryoutSets = await trx.query.tryout_sets.findMany({
        where: eq(schema.tryout_sets.tryoutId, tryoutId),
      });

      // duplicate tryout sets
      for (let i = 0; i < tryoutSets.length; i++) {
        const newTryoutSet = await trx
          .insert(schema.tryout_sets)
          .values({
            duration: tryoutSets[i].duration,
            subjectId: tryoutSets[i].subjectId,
            tryoutId: newTryout[0].id,
          })
          .returning();

        const tryoutQuestions = await trx.query.tryout_questions.findMany({
          where: eq(schema.tryout_questions.tryoutSetId, tryoutSets[i].id),
        });

        // duplicate tryout questions
        for (let j = 0; j < tryoutQuestions.length; j++) {
          const newTryoutQuestion = await trx
            .insert(schema.tryout_questions)
            .values({
              content: tryoutQuestions[j].content,
              contentImage: tryoutQuestions[j].contentImage,
              tryoutSetId: newTryoutSet[0].id,
              isTextAnswer: tryoutQuestions[j].isTextAnswer,
              options: tryoutQuestions[j].options,
              questionId: tryoutQuestions[j].questionId,
              source: tryoutQuestions[j].source,
            })
            .returning();

          const pembahasan = await trx.query.tryout_pembahasan.findFirst({
            where: eq(
              schema.tryout_pembahasan.tryoutQuestionId,
              tryoutQuestions[j].id,
            ),
          });

          if (pembahasan) {
            await trx
              .insert(schema.tryout_pembahasan)
              .values({
                content: pembahasan.content,
                contentImage: pembahasan.contentImage,
                tryoutQuestionId: newTryoutQuestion[0].id,
              })
              .execute();
          }
        }
      }
      return newTryout[0];
    });

    return newTryout;
  }

  async deleteTryout(tryoutId: string) {
    const tryout = await this.db.query.tryouts.findFirst({
      where: eq(schema.tryouts.id, tryoutId),
    });

    if (!tryout) {
      throw new NotFoundException('Tryout not found');
    }

    // check if tryout has been attempted
    const tryoutAttempts = await this.db.query.tryout_attempts.findMany({
      where: eq(schema.tryout_attempts.tryoutId, tryoutId),
    });

    if (tryoutAttempts.length) {
      throw new Error('Tryout has been attempted');
    }

    // get all sets
    const tryoutSets = await this.db.query.tryout_sets.findMany({
      where: eq(schema.tryout_sets.tryoutId, tryoutId),
    });

    await this.db
      .update(schema.tryouts)
      .set({
        firstSetId: null,
      })
      .where(eq(schema.tryouts.id, tryoutId));

    for (let i = 0; i < tryoutSets.length; i++) {
      await this.db
        .update(schema.tryout_sets)
        .set({
          nextSet: null,
        })
        .where(eq(schema.tryout_sets.id, tryoutSets[i].id));
    }

    for (let i = 0; i < tryoutSets.length; i++) {
      // get all questions from the set
      const tryoutQuestions = await this.db.query.tryout_questions.findMany({
        where: eq(schema.tryout_questions.tryoutSetId, tryoutSets[i].id),
      });

      if (tryoutQuestions.length > 0) {
        // remove all pembahasan
        const pembahasanIds = tryoutQuestions.map((q) => q.id);

        await this.db
          .delete(schema.tryout_pembahasan)
          .where(
            inArray(schema.tryout_pembahasan.tryoutQuestionId, pembahasanIds),
          );

        // remove all questions
        await this.db
          .delete(schema.tryout_questions)
          .where(eq(schema.tryout_questions.tryoutSetId, tryoutSets[i].id));
      }

      // remove the set
      await this.db
        .delete(schema.tryout_sets)
        .where(eq(schema.tryout_sets.id, tryoutSets[i].id));
    }

    await this.db.delete(schema.tryouts).where(eq(schema.tryouts.id, tryoutId));

    return true;
  }

  async generateTryoutSetPDF(setId: string) {
    const tryoutSet = await this.db
      .select({
        id: schema.tryout_sets.id,
        subject_name: schema.tryout_subjects.name,
        question_count: schema.tryout_subjects.questionsLimit,
        tryout_title: schema.tryouts.name,
      })
      .from(schema.tryout_sets)
      .leftJoin(
        schema.tryout_subjects,
        eq(schema.tryout_sets.subjectId, schema.tryout_subjects.id),
      )
      .leftJoin(
        schema.tryouts,
        eq(schema.tryout_sets.tryoutId, schema.tryouts.id),
      )
      .where(eq(schema.tryout_sets.id, setId))
      .execute();

    if (!tryoutSet) {
      throw new NotFoundException('Tryout set not found');
    }

    const tryoutQuestions = await this.db.query.tryout_questions.findMany({
      where: eq(schema.tryout_questions.tryoutSetId, setId),
      orderBy: asc(schema.tryout_questions.createdAt),
      columns: {
        content: true,
        contentImage: true,
        source: true,
        options: true,
      },
    });

    if (!tryoutQuestions.length) {
      throw new NotFoundException('No questions found');
    }

    const res = {
      set: tryoutSet[0],
      questions: tryoutQuestions,
    };

    return res;
  }
}

export default TryoutCMSService;
