import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { TuringGuard } from 'src/authentication/guard/turing.guard';
import LatihanSoalCmsService from './latihan-soal-cms.service';
import { UpdateLatihanSoalDTO } from '../latihan-soal/latihan-soal.dto';
import { LargePageOptionsDto } from 'src/common/dtos/page.dtos';

@UseGuards(TuringGuard)
@Controller('latihan-soal-cms')
export default class LatihanSoalCmsController {
  constructor(private readonly latihanSoalCmsService: LatihanSoalCmsService) {}

  @Get('questions')
  async getQuestions(@Query() { page, limit }: LargePageOptionsDto) {
    return this.latihanSoalCmsService.getQuestions(page, limit);
  }

  @Get('feedbacks')
  async getAllFeedback() {
    return this.latihanSoalCmsService.getAllQuestionsWithFeedback();
  }

  @Get('feedback/topics')
  async getAllFeedbackedTopics() {
    return this.latihanSoalCmsService.getAllFeedbackedTopics();
  }

  @Get('feedback/topic/:topic_id')
  async getFeedbackByTopicId(@Param('topic_id') topicId: string) {
    return this.latihanSoalCmsService.getQuestionFeedbackByTopicId(topicId);
  }

  @Get('feedback/question/:question_id')
  async getFeedbackByQuestionId(@Param('question_id') questionId: string) {
    return this.latihanSoalCmsService.getQuestionFeedbackByQuestionId(
      questionId,
    );
  }

  @Put('soal/update')
  async updateLatihanSoal(@Body() body: UpdateLatihanSoalDTO) {
    return await this.latihanSoalCmsService.upsertLatihanSoal(body);
  }

  @Put('qc/unpass/:question_id')
  async unpassQuestion(@Param('question_id') questionId: string) {
    return this.latihanSoalCmsService.unpassQuestionQc(questionId);
  }

  @Get('questions/statistics/:question_id')
  async getQuestionStatistics(@Param('question_id') questionId: string) { 
    return this.latihanSoalCmsService.getQuestionStatistics(questionId);
  }

  @Put('status/:question_id')
  async updateQuestionStatus(
    @Param('question_id') questionId: string,
    @Body() body: { status: boolean },
  ) {
    return this.latihanSoalCmsService.updateQuestionStatus(questionId, body);
  }
}
