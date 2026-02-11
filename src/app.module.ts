import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { AuthenticationModule } from './authentication/authentication.module';
import { DrizzleModule } from './database/drizzle/drizzle.module';
import { ConfigModule } from '@nestjs/config';
import { JwtStrategy } from './authentication/strategy/jwt.strategy';
import { TryoutCMSModule } from './api/tryout-cms/tryout-cms.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { S3Module } from './s3/s3.module';
import { FirebaseModule } from './database/firebase/firebase.module';
import { SubjectsModule } from './api/subjects/subjects.module';
import LatihanSoalModule from './api/latihan-soal/latihan-soal.module';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import PtnModule from './api/ptn/ptn.module';
import PackagesModule from './api/packages/packages.module';
import UsersModule from './api/users/users.module';
import { RedisModule } from '@nestjs-modules/ioredis';
import LeaderboardsModule from './api/leaderboards/leaderboards.module';
import BangCatatanModule from './api/bang-catatan/bang-catatan.module';
import PaymentsModule from './api/payments/payments.module';
import { ScheduleModule } from '@nestjs/schedule';
import { DashboardModule } from './api/dashboard/dashboard.modules';
import { LatihanSoalHistoryModule } from './api/latihan-soal-history/latihan-soal-history.module';
import { ThrottlerModule } from '@nestjs/throttler';
import SESModule from './ses/ses.module';
import LatihanSoalCmsModule from './api/latihan-soal-cms/latihan-soal-cms.module';
import { TryoutModule } from './api/tryout/tryout.module';
import { TryoutHistoryModule } from './api/tryout-history/tryout-history.module';
import { TryoutWorkerModule } from './workers/tryout/tryout.module';
import { TryoutLeaderboardModule } from './api/tryout-leaderboard/tryout-leaderboard.module';
import ReferralModule from './api/referral/referral.module';
import AcademicStatisticModule from './api/academic-statistic/academic-statistic.module';
import { AppController } from './app.controller';
import SubjectsCmsModule from './api/subjects-cms/subjects-cms-module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),

    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      url: process.env.REDIS_URL,
    }),
    RedisModule.forRoot(
      process.env.CACHE_URL
        ? {
            config: {
              url: process.env.CACHE_URL,
            },
          }
        : {
            config: {
              url: 'redis://127.0.0.1:6379',
              password: process.env.REDIS_PASSWORD,
            },
          },
    ),
    AuthenticationModule,
    UsersModule,
    DrizzleModule,
    PassportModule,
    JwtModule.register({
      secret: 'b4ngsoal',
      signOptions: { expiresIn: '259200s' },
    }),
    TryoutModule,
    TryoutHistoryModule,
    TryoutCMSModule,
    S3Module,
    FirebaseModule,
    SubjectsModule,
    LatihanSoalModule,
    PtnModule,
    PackagesModule,
    LeaderboardsModule,
    BangCatatanModule,
    PaymentsModule,
    DashboardModule,
    LatihanSoalHistoryModule,
    SESModule,
    LatihanSoalCmsModule,
    TryoutWorkerModule,
    TryoutLeaderboardModule,
    ReferralModule,
    AcademicStatisticModule,
    SubjectsCmsModule,
  ],
  providers: [AppService, JwtStrategy],
  controllers: [AppController],
})
export class AppModule {}
