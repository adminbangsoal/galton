import { Module } from '@nestjs/common';
import { LatihanSoalHistoryController } from './latihan-soal-history.controller';
import { LatihanSoalHistoryService } from './latihan-soal-history.service';
import { drizzleProvider } from 'src/database/drizzle/drizzle.provider';
import LatihanSoalModule from '../latihan-soal/latihan-soal.module';
import LatihanSoalService from '../latihan-soal/latihan-soal.service';

@Module({
  imports: [LatihanSoalModule],
  controllers: [LatihanSoalHistoryController],
  providers: [
    LatihanSoalHistoryService,
    ...drizzleProvider,
    LatihanSoalService,
  ],
})
export class LatihanSoalHistoryModule {}
