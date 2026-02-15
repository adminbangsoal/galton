import { Module } from '@nestjs/common';
import LeaderdboardsController from './leaderboards.controller';
import { LeaderboardService } from './leaderboards.service';
import { S3Module } from '../../s3/s3.module';
import { drizzleProvider } from '../../database/drizzle/drizzle.provider';

@Module({
  imports: [S3Module],
  controllers: [LeaderdboardsController],
  providers: [LeaderboardService, ...drizzleProvider],
})
export default class LeaderboardsModule {}
