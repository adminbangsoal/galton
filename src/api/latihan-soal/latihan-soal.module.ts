import { Module } from '@nestjs/common';
import LatihanSoalController from './latihan-soal.controller';
import LatihanSoalService from './latihan-soal.service';
import { drizzleProvider } from '../../database/drizzle/drizzle.provider';
import { S3Module } from '../../s3/s3.module';

@Module({
  imports: [S3Module],
  controllers: [LatihanSoalController],
  providers: [LatihanSoalService, ...drizzleProvider],
  exports: [LatihanSoalService, S3Module],
})
export default class LatihanSoalModule {}
