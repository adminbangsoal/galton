import { Inject, Injectable } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DrizzleAsyncProvider } from 'src/database/drizzle/drizzle.provider';
import * as schema from 'src/database/schema';
import { and, eq, sql, asc, gt, lt, desc, lte } from 'drizzle-orm';
import { S3Service } from 'src/s3/s3.service';

@Injectable()
class UpdateModalService {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private db: PostgresJsDatabase<typeof schema>,
    private s3Service: S3Service,
  ) {}

  async getLatestUpdates() {
    const latestUpdates = await this.db
      .select()
      .from(schema.update_modals)
      .where(
        and(
          lte(schema.update_modals.startedAt, new Date()),
          gt(schema.update_modals.expiredAt, new Date()),
        ),
      )
      .orderBy(desc(schema.update_modals.startedAt)); // start from latest

    if (!latestUpdates.length) return null;

    for (let i = 0; i < latestUpdates.length; i++) {
      const updateModal = latestUpdates[i];
      const key = this.s3Service.getObjectKeyFromUrl(updateModal.imageUrl);
      if (key) {
        const url = await this.s3Service.getPresignedUrl(key);
        updateModal.imageUrl = url;
      } else {
        updateModal.imageUrl = null;
      }
    }

    return { latest_updates: latestUpdates };
  }
}

export default UpdateModalService;
