import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/authentication/guard/jwt.guard';
import { Request } from 'express';
import { LatihanSoalHistoryService } from './latihan-soal-history.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LatihanSoalHistoryQuery } from './latihan-soal-history.dto';

@ApiTags('Latihan Soal History')
@Controller('latihan/history')
export class LatihanSoalHistoryController {
  constructor(
    private readonly latihanSoalHistoryService: LatihanSoalHistoryService,
  ) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('subject/:subject_id')
  async getLatihanSoalHistory(
    @Req() req: Request,
    @Param('subject_id') subject_id: string,
    @Query() { topic_id, min_year, max_year }: LatihanSoalHistoryQuery,
  ) {
    return await this.latihanSoalHistoryService.getLatihanSoalHistory(
      (req.user as any).userId,
      subject_id,
      topic_id,
      min_year,
      max_year,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('/mobile/subject/:subject_id')
  async getMobileLatihanSoalHistory(
    @Req() req: Request,
    @Param('subject_id') subject_id: string,
    @Query() { topic_id, min_year, max_year, limit }: LatihanSoalHistoryQuery,
  ) {
    return await this.latihanSoalHistoryService.getMobileLatihanSoalHistory(
      (req.user as any).userId,
      subject_id,
      topic_id,
      min_year,
      max_year,
      limit,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('timed-questions')
  async getTimedQuestionsHistoryList(@Req() req: Request) {
    return await this.latihanSoalHistoryService.getTimedLatihanSoalHistoryList(
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':question_id')
  async getLatihanSoalHistoryByQuestionId(
    @Req() req: Request,
    @Param('question_id') question_id: string,
  ) {
    return await this.latihanSoalHistoryService.getLatihanHistoryByQuestionId(
      question_id,
      (req.user as any).userId,
    );
  }
}
