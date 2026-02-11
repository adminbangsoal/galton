import { Module } from '@nestjs/common';

import { drizzleProvider } from 'src/database/drizzle/drizzle.provider';
import TryoutWorkerService from './tryout.service';
import { S3Module } from 'src/s3/s3.module';

@Module({
  imports: [S3Module],
  providers: [TryoutWorkerService, ...drizzleProvider],
  exports: [TryoutWorkerService],
})
export class TryoutWorkerModule {}
