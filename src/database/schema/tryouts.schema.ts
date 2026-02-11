import {
  AnyPgColumn,
  boolean,
  decimal,
  doublePrecision,
  foreignKey,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { bigint } from 'drizzle-orm/pg-core';
import { users } from './users.schema';
import { relations, sql } from 'drizzle-orm';
import { Options } from './options.schema';
import { questions } from './questions.schema';

export type LatexContent = {
  content: string;
  isMedia: boolean;
};

export const tryoutGeneratorCode = pgEnum('tryout_generator_code', [
  'english',
  'math',
  'indonesia',
  'logic',
]);

export const tryoutQuestionType = pgEnum('tryout_question_type', [
  'multiple-choice',
  'multiple-answer',
  'table-choice',
  'fill-in',
]);

export const tryouts = pgTable('tryouts', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', {
    length: 100,
  })
    .notNull()
    .unique(),
  startDate: timestamp('start_date')
    .notNull()
    .default(sql`now()`),
  expiryDate: timestamp('validity_date').notNull(),
  correctBasePoint: integer('correct_base_point').default(4),
  wrongBasePoint: integer('wrong_base_point').default(0),
  logoSrc: varchar('logo_src').default(''), // TODO: add default logo
  description: varchar('description', {
    length: 300,
  }).notNull(),
  isIrt: boolean('is_irt').default(true),
  label: text('label').default(''),
  createdAt: timestamp('created_at').default(sql`now()`),
  timeLimit: bigint('time_limit', {
    mode: 'number',
  }),
  bufferDuration: bigint('buffer_duration', {
    mode: 'number',
  }).default(0),
  isPublished: boolean('is_published').default(false),
  isKilat: boolean('is_kilat').default(true),
  eventName: text('event_name'),
  eventCode: text('event_code'),
  firstSetId: uuid('first_set_id').references(
    (): AnyPgColumn => tryout_sets.id,
  ),
  isWindow: boolean('is_window').default(false),
});

export const tryout_sets = pgTable(
  'tryout_sets',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    order: integer('order'),
    tryoutId: uuid('tryout_id')
      .references(() => tryouts.id)
      .notNull(),
    duration: bigint('duration', {
      mode: 'number',
    }).notNull(),
    subjectId: uuid('subject_id')
      .references(() => tryout_subjects.id)
      .notNull(),
    createdAt: timestamp('created_at').default(sql`now()`),
    nextSet: uuid('next_set').references((): AnyPgColumn => tryout_sets.id),
    // previousSet: uuid('previous_set').references(() => tryout_sets.id),
  },
  (table) => {
    return {
      parentReference: foreignKey({
        columns: [table.nextSet],
        foreignColumns: [table.id],
      }),
      unq: unique().on(table.tryoutId, table.subjectId),
    };
  },
);

export const contractsRelations = relations(tryout_sets, ({ one, many }) => ({
  underlying: one(tryout_sets, {
    fields: [tryout_sets.nextSet],
    references: [tryout_sets.id],
  }),
}));

export const tryout_attempts = pgTable('tryout_attempts', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  startedAt: timestamp('started_at').default(sql`now()`),
  submittedAt: timestamp('submitted_at'),
  userId: uuid('user_id').references(() => users.id),
  tryoutId: uuid('tryout_id').references(() => tryouts.id),
  score: doublePrecision('score').default(0.0), // will be calculated after tryout expiry date
  currentTryoutSetId: uuid('current_tryout_set_id').references(
    () => tryout_sets.id,
  ), // null if not started or in between sets
});

export const tryout_set_attempts = pgTable(
  'tryout_set_attempts',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    startedAt: timestamp('started_at').default(sql`now()`),
    submittedAt: timestamp('submitted_at'),
    tryoutId: uuid('tryout_id')
      .references(() => tryouts.id)
      .notNull(),
    tryoutSetId: uuid('tryout_set_id')
      .references(() => tryout_sets.id)
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    currentQuestionId: uuid('current_question_id')
      .references(() => tryout_questions.id)
      .notNull(),
    score: doublePrecision('score').default(0.0), // will be calculated after tryout expiry date
  },
  (t) => ({
    unq: unique().on(t.tryoutId, t.tryoutSetId, t.userId),
  }),
);

export const tryout_questions = pgTable('tryout_questions', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tryoutSetId: uuid('tryout_set_id').references(() => tryout_sets.id),
  content: text('content').notNull(),
  contentImage: text('content_image').default(''),
  options: jsonb('options').$type<Options[]>().notNull(),
  isTextAnswer: boolean('is_text_answer').default(false),
  createdAt: timestamp('created_at').default(sql`now()`),
  source: text('source').notNull(),
  questionId: uuid('question_id').references(() => questions.id),
  explanations: jsonb('explanations').$type<LatexContent[]>().default([]),
  explanationLikeCount: bigint('like_count', {
    // every dislike will decrement the value
    mode: 'number',
  }),

  // it will be updated by worker after tryout has expired.
  // The weight is determined based on the percentage of correct answers by users IF Tryout IS IRT,
  // else its tryout.correct_base_point
  correctScoreWeight: doublePrecision('correct_score_weight').default(0.0),
  wrongScoreWeight: doublePrecision('wrong_score_weight').default(0.0),
  type: tryoutQuestionType('type').notNull().default('multiple-choice'),
  answers: jsonb('answers').$type<string[]>(),
});


export const tryout_question_attempts = pgTable(
  'tryout_question_attempts',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tryoutId: uuid('tryout_id').references(() => tryouts.id),
    userId: uuid('user_id').references(() => users.id),
    answer: text('answer'), // should be the content of option, or free text if not MCQ. Could be null, if user just want to flag the question
    tryoutSetId: uuid('tryout_set').references(() => tryout_sets.id),
    optionId: text('option_id'), // null if not MCQ
    tryoutQuestionId: uuid('tryout_question').references(
      () => tryout_questions.id,
    ),
    isFlagged: boolean('is_flagged').default(false),
    score: doublePrecision('score').default(0.0), // it will be updated by worker after tryout has expired
    filledAnswers: jsonb('filled_answers').$type<string[]>().default([]),
  },
  (t) => ({
    unq: unique().on(t.tryoutQuestionId, t.userId, t.tryoutSetId),
  }),
);

export const tryout_subjects = pgTable('tryout_subjects', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: varchar('name', {
    length: 100,
  }).notNull(),
  questionsLimit: integer('questions_limit'),
  generatorCode: tryoutGeneratorCode('generator_code'),
  questionDuration: bigint('question_duration', {
    // every dislike will decrement the value
    mode: 'number',
  }),
});

export const tryout_pembahasan = pgTable('tryout_pembahasan', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  tryoutQuestionId: uuid('tryout_question_id').references(
    () => tryout_questions.id,
  ),
  content: text('content').notNull(),
  contentImage: text('content_image').default(''),
  likeCount: bigint('like_count', {
    // every dislike will decrement the value
    mode: 'number',
  })
    .notNull()
    .default(0),
  createdAt: timestamp('created_at').default(sql`now()`),
  pembahasanImage: text('pembahasan_image').default(''),
});

export const tryout_question_notes = pgTable('tryout_question_notes', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  assetUrl: text('asset_url').notNull(),
  tryoutQuestionId: uuid('tryout_question_id').references(
    () => tryout_questions.id,
  ),
  userId: uuid('user_id')
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const tryout_pembahasan_feedback = pgTable(
  'tryout_pembahasan_feedback',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tryoutQuestionId: uuid('tryout_question_id').references(
      () => tryout_questions.id,
    ),
    userId: uuid('user_id')
      .references(() => users.id)
      .notNull(),
    timestamp: timestamp('timestamp')
      .notNull()
      .default(sql`now()`),
    isLiked: boolean('is_liked').notNull(),
  },
);

export type TryoutQuestion = typeof tryout_questions.$inferSelect;