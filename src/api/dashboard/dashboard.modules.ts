import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { drizzleProvider } from '../../database/drizzle/drizzle.provider';
import UsersModule from '../users/users.module';
import { S3Module } from '../../s3/s3.module';
import LatihanSoalModule from '../latihan-soal/latihan-soal.module';

@Module({
  imports: [UsersModule, S3Module, LatihanSoalModule],
  controllers: [DashboardController],
  providers: [DashboardService, ...drizzleProvider],
})
export class DashboardModule {}
