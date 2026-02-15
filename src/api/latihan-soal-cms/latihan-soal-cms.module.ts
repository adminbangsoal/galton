import { Module } from '@nestjs/common';
import LatihanSoalCmsController from './latihan-soal-cms.controller';
import LatihanSoalCmsService from './latihan-soal-cms.service';
import { drizzleProvider } from '../../database/drizzle/drizzle.provider';

@Module({
  providers: [LatihanSoalCmsService, ...drizzleProvider],
  controllers: [LatihanSoalCmsController],
  imports: [],
})
export default class LatihanSoalCmsModule {}
