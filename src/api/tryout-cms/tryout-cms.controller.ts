import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import TryoutService from './tryout-cms.service';
import { ApiTags } from '@nestjs/swagger';
import {
  CreateSubjectDto,
  CreateTryoutDto,
  CreateTryoutQuestionDto,
  CreateTryoutSetDto,
  DuplicateTryoutDto,
  GenerateTryoutSetPDF,
  SwapTryoutSetDto,
  UpdateTryoutDto,
  UpdateTryoutQuestionDto,
} from './tryout-cms.dto';
import { TuringGuard } from '../../authentication/guard/turing.guard';
import TryoutWorkerService from '../../workers/tryout/tryout.service';

@ApiTags('Tryout CMS')
@UseGuards(TuringGuard)
@Controller('tryout-cms')
export class TryoutCMSController {
  constructor(
    private readonly tryoutService: TryoutService,
    private readonly tryoutWorkerService: TryoutWorkerService,
  ) {}

  @Get('/')
  async getAllTryouts(@Query('labels') labels: string) {
    return await this.tryoutService.getAllTryout(labels);
  }

  @Get('/labels')
  async getAllTryoutLabels() {
    return await this.tryoutService.getAllTryoutLabels();
  }

  @Post('/')
  async createTryout(@Body() data: CreateTryoutDto) {
    return await this.tryoutService.createTryout(data);
  }

  @Post('/set')
  async createTryoutSet(@Body() data: CreateTryoutSetDto) {
    return await this.tryoutService.createTryoutSet(data);
  }

  @Get('/set/count')
  async getTryoutSetCount() {
    return await this.tryoutService.getTryoutSetQuestionCounts();
  }

  @Post('/set/swap')
  async swapTryoutSetOrder(@Body() data: SwapTryoutSetDto) {
    return await this.tryoutService.swapTryoutSetOrder(
      data.tryout_set_id_1,
      data.tryout_set_id_2,
    );
  }

  @Put('/publish/:tryout_id')
  async togglePublishTryout(@Param('tryout_id') tryout_id: string) {
    return await this.tryoutService.togglePublishTryout(tryout_id);
  }

  @Get('/set/detail/:set_id')
  async getTryoutSetDetail(@Param('set_id') set_id: string) {
    return await this.tryoutService.getTryoutSetDetails(set_id);
  }

  @Get('/set/questions/:set_id')
  async getTryoutSetQuestionsCount(@Param('set_id') set_id: string) {
    return await this.tryoutService.getTryoutSetQuestionsCount(set_id);
  }

  @Get('/set/:tryout_id')
  async getTryoutSet(@Param('tryout_id') tryout_id: string) {
    return await this.tryoutService.getTryoutSetByTryoutId(tryout_id);
  }

  @Get('/set/sort/:tryout_id')
  async getSortedTryoutSet(@Param('tryout_id') tryout_id: string) {
    return await this.tryoutService.getSortedTryoutSetByTryoutId(tryout_id);
  }

  @Get('/subjects')
  async getAllTryoutSubjects() {
    return await this.tryoutService.getAllTryoutSubjects();
  }

  @Post('/subjects')
  async createTryoutSubject(@Body() data: CreateSubjectDto) {
    return await this.tryoutService.createTryoutSubject(data);
  }

  @Post('question/:tryout_id_set')
  async createTryoutQuestion(
    @Param('tryout_id_set') tryout_id_set: string,
    @Body() data: CreateTryoutQuestionDto,
  ) {
    return await this.tryoutService.createTryoutQuestions(tryout_id_set, data);
  }

  @Put('question/:question_id')
  async updateTryoutQuestionById(
    @Param('question_id') question_id: string,
    @Body() data: UpdateTryoutQuestionDto,
  ) {
    return await this.tryoutService.updateTryoutQuestion(question_id, data);
  }

  @Get('question/:question_id')
  async getTryoutQuestionById(@Param('question_id') question_id: string) {
    return await this.tryoutService.getTryoutQuestionById(question_id);
  }

  @Get('set/question/:tryout_id_set')
  async getTryoutQuestionBySetId(
    @Param('tryout_id_set') tryout_id_set: string,
  ) {
    return await this.tryoutService.getTryoutQuestionBySetId(tryout_id_set);
  }

  @Post('duplicate/:tryout_id')
  async duplicateTryout(
    @Param('tryout_id') tryoutId: string,
    @Body() { name }: DuplicateTryoutDto,
  ) {
    return await this.tryoutService.duplicateTryout(tryoutId, name);
  }

  @Get('/pdf/set/:set_id')
  async generateTryoutSetPDF(@Param() params: GenerateTryoutSetPDF) {
    return await this.tryoutService.generateTryoutSetPDF(params.set_id);
  }

  @Delete('/:tryout_id')
  async deleteTryout(@Param('tryout_id') tryout_id: string) {
    return await this.tryoutService.deleteTryout(tryout_id);
  }

  @Get('/:tryout_id')
  async getTryoutById(@Param('tryout_id') tryout_id: string) {
    return await this.tryoutService.getTryoutById(tryout_id);
  }

  @Post('calculate-score/:tryout_id')
  async calculateTryoutScore(@Param('tryout_id') tryout_id: string) {
    return await this.tryoutWorkerService.calculateUsersTryoutScores(tryout_id);
  }

  @Put('/:tryout_id')
  async updateTryout(
    @Param('tryout_id') tryout_id: string,
    @Body() data: UpdateTryoutDto,
  ) {
    return await this.tryoutService.updateTryout(tryout_id, data);
  }
}
