import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, and, not } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DrizzleAsyncProvider } from 'src/database/drizzle/drizzle.provider';
import * as schema from 'src/database/schema';

@Injectable()
export class SubjectsService {
  private readonly logger = new Logger(SubjectsService.name);

  constructor(
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
  ) { }

  async getSubjectBySlug(slug: string) {
    this.logger.log(`service starts getting subject by slug: ${slug}`);

    const subject = await this.db.select().from(schema.subjects).where(and(eq(schema.subjects.slug, slug), not(eq(schema.subjects.name, 'UNDECIDED')))).execute();

    if (!subject.length) {
      this.logger.warn(`subject with slug ${slug} not found`);

      return null
    }
    this.logger.log(`service successfully got subject by slug: ${slug}`);

    return subject[0]
  }

  async getAllTopics() {
    const topics = await this.db.select().from(schema.topics).where(not(eq(schema.topics.name, 'UNDECIDED'))).execute();
    const res = []

    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      const hasQuestions = await this.checkIfTopicHaveQuestions(topic);
      if (hasQuestions) {
        res.push(topic);
      }
    }

    return res;
  }

  async getAllSubjects() {
    const subjects = await this.db.select().from(schema.subjects).where(not(eq(schema.subjects.name, 'UNDECIDED'))).execute();

    const res = []
    for (let i = 0; i < subjects.length; i++) {
      const subject = subjects[i];
      const hasQuestions = await this.checkIfSubjectHaveQuestions(subject);
      if (hasQuestions) {
        res.push(subject);
      }
    }

    return res;
  }

  async getTopicBySubjectId(subjectId: string) {
    console.log('Started getting topics by subject id');
    const topics = await this.db
      .select()
      .from(schema.topics)
      .where(eq(schema.topics.subject_id, subjectId))
      .execute();

    const res = []

    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      const hasQuestions = await this.checkIfTopicHaveQuestions(topic);
      if (hasQuestions && topic.name !== 'Subtype result not found') {
        res.push(topic);
      }
    }

    return res;
  }

  async checkIfSubjectHaveQuestions(subject: schema.Subjects) {
    const questions = await this.db
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.subject_id, subject.id))
      .limit(1)
      .execute();

    return questions.length > 0;

  }

  async checkIfTopicHaveQuestions(topic: schema.Topics) {
    const questions = await this.db
      .select()
      .from(schema.questions)
      .where(eq(schema.questions.topic_id, topic.id))
      .limit(1)
      .execute();

    return questions.length > 0;
  }

}
