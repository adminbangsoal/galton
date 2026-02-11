import { pgTable, text, uuid } from "drizzle-orm/pg-core";
import { questions } from "./questions.schema";
import { subjects } from "./subjects.schema";
import { topics } from "./topics.schema";
import { sql } from "drizzle-orm";

export const tempQuestionSubject = pgTable("temp_question_subject", {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    timestamp: text('timestamp').notNull(),
    questionId: uuid('question_id').references(() => questions.id).notNull(),
    oldSubjectId: uuid('old_subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    newSubjectId: uuid('new_subject_id').references(() => subjects.id),
    oldSubjectName: text('old_subject_name').notNull(),
    newSubjectName: text('new_subject_name').notNull(),
    oldTopicId: uuid('old_topic_id').references(() => topics.id, { onDelete: 'set null' }),
    newTopicId: uuid('new_topic_id').references(() => topics.id),
    oldTopicName: text('old_topic_name').notNull(),
    newTopicName: text('new_topic_name').notNull(),
    predictionDescription: text('prediction_description').notNull(),
})