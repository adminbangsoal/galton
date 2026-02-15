import { Module } from '@nestjs/common';
import { TryoutLeaderboardController } from './tryout-leaderboard.controller';

import { drizzleProvider } from '../../database/drizzle/drizzle.provider';
import TryoutLeaderboardService from './tryout-leaderboard.service';
import { S3Module } from '../../s3/s3.module';

@Module({
  imports: [S3Module],
  providers: [TryoutLeaderboardService, ...drizzleProvider],
  controllers: [TryoutLeaderboardController],
})
export class TryoutLeaderboardModule {}
