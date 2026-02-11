import { Module } from '@nestjs/common';
import { TryoutHistoryController } from './tryout-history.controller';

import { drizzleProvider } from 'src/database/drizzle/drizzle.provider';
import TryoutHistoryService from './tryout-history.service';
import { S3Module } from 'src/s3/s3.module';
import { TryoutWorkerModule } from 'src/workers/tryout/tryout.module';

@Module({
  imports: [S3Module, TryoutWorkerModule],
  providers: [TryoutHistoryService, ...drizzleProvider],
  controllers: [TryoutHistoryController],
})
export class TryoutHistoryModule {}
