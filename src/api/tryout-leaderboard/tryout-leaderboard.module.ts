import { Module } from '@nestjs/common';
import { TryoutLeaderboardController } from './tryout-leaderboard.controller';

import { drizzleProvider } from 'src/database/drizzle/drizzle.provider';
import TryoutLeaderboardService from './tryout-leaderboard.service';
import { S3Module } from 'src/s3/s3.module';

@Module({
  imports: [S3Module],
  providers: [TryoutLeaderboardService, ...drizzleProvider],
  controllers: [TryoutLeaderboardController],
})
export class TryoutLeaderboardModule {}
