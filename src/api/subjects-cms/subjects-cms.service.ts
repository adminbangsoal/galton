import { Inject, Injectable, Logger } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DrizzleAsyncProvider } from 'src/database/drizzle/drizzle.provider';
import * as schema from 'src/database/schema';

@Injectable()
export default class SubjectsCmsService {
  private readonly logger = new Logger(SubjectsCmsService.name);
  constructor(
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
  ) {}

  async getAllSubjects() {
    const subjects = await this.db.select().from(schema.subjects).execute();
    return subjects;
  }

  async getAllTopics() {
    const topics = await this.db.select().from(schema.topics).execute();
    return topics;
  }
}
