import { Inject, Injectable } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DrizzleAsyncProvider } from '../../database/drizzle/drizzle.provider';
import * as schema from '../../database/schema';

@Injectable()
export default class PackagesService {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
  ) {}

  async getAllPackages() {
    const packages = await this.db.query.packages.findMany();
    return packages;
  }
}
