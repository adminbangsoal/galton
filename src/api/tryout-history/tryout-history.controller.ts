import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import TryoutHistoryService from './tryout-history.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/authentication/guard/jwt.guard';
import {
  AddFeedbackDto,
  AddQuestionNoteDto,
  JobDto,
} from './tryout-history.dto';
import { TuringGuard } from 'src/authentication/guard/turing.guard';

@ApiTags('Tryout History')
@Controller('tryout-history')
export class TryoutHistoryController {
  constructor(private readonly tryoutHistoryService: TryoutHistoryService) {}

  @ApiBearerAuth()
  @Get('/')
  @UseGuards(JwtAuthGuard)
  async getAllTryoutHistories(@Req() req: Request) {
    return await this.tryoutHistoryService.getAllTryoutHistories(
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @Get('/:tryout_id/sets')
  @UseGuards(JwtAuthGuard)
  async getTryoutSetHistories(
    @Req() req: Request,
    @Param('tryout_id') tryout_id: string,
  ) {
    return await this.tryoutHistoryService.getTryoutSetHistories(
      tryout_id,
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @Get('sets/:set_id/questions')
  @UseGuards(JwtAuthGuard)
  async getQuestionHistoriesOfSet(
    @Req() req: Request,
    @Param('set_id') set_id: string,
  ) {
    return await this.tryoutHistoryService.getQuestionHistoriesOfSet(
      set_id,
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @Get('/questions/:question_id')
  @UseGuards(JwtAuthGuard)
  async getQuestionDetails(
    @Param('question_id') question_id: string,
    @Req() req: Request,
  ) {
    return await this.tryoutHistoryService.getQuestionDetails(
      question_id,
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @Get('/questions/:question_id/notes')
  @UseGuards(JwtAuthGuard)
  async getQuestionNotes(
    @Param('question_id') question_id: string,
    @Req() req: Request,
  ) {
    return await this.tryoutHistoryService.getQuestionNotes(
      question_id,
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @Get('/questions/:question_id/explanation')
  @UseGuards(JwtAuthGuard)
  async getQuestionExplanation(
    @Param('question_id') question_id: string,
    @Req() req: Request,
  ) {
    return await this.tryoutHistoryService.getQuestionExplanation(
      question_id,
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @Post('/questions/:question_id/explanation-feedback')
  @UseGuards(JwtAuthGuard)
  async addExplanationFeedback(
    @Param('question_id') question_id: string,
    @Req() req: Request,
    @Body() data: AddFeedbackDto,
  ) {
    return await this.tryoutHistoryService.addExplanationFeedback(
      question_id,
      (req.user as any).userId,
      data.is_liked,
    );
  }

  @ApiBearerAuth()
  @Post('/questions/:question_id/notes')
  @UseGuards(JwtAuthGuard)
  async addQuestionNote(
    @Param('question_id') question_id: string,
    @Req() req: Request,
    @Body() data: AddQuestionNoteDto,
  ) {
    return await this.tryoutHistoryService.addQuestionNote(
      question_id,
      (req.user as any).userId,
      data.asset_url,
    );
  }

  @ApiBearerAuth()
  @Get('/questions/:question_id/analytics')
  @UseGuards(JwtAuthGuard)
  async getQuestionAnalytics(
    @Param('question_id') question_id: string,
    @Req() req: Request,
  ) {
    return await this.tryoutHistoryService.getQuestionAnalytics(
      question_id,
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @Post('/jobs')
  @UseGuards(TuringGuard)
  async addTryoutScoreCalculationJob(@Body() data: JobDto) {
    return await this.tryoutHistoryService.addTryoutScoreCalculationJob(
      data.tryout_id,
    );
  }

  @ApiBearerAuth()
  @Delete('/jobs')
  @UseGuards(TuringGuard)
  async removeTryoutScoreCalculationJob(@Body() data: JobDto) {
    return await this.tryoutHistoryService.removeTryoutScoreCalculationJob(
      data.tryout_id,
    );
  }

  @ApiBearerAuth()
  @Get('/score-analytics')
  @UseGuards(JwtAuthGuard)
  async getTryoutScoreAnalytics(@Req() req: Request) {
    return await this.tryoutHistoryService.getTryoutScoreAnalytics(
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @Get('/subject-analytics')
  @UseGuards(JwtAuthGuard)
  async getTryoutSubjectAnalytics(@Req() req: Request) {
    return await this.tryoutHistoryService.getTryoutSubjectAnalytics(
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @Get('/:tryout_id')
  @UseGuards(JwtAuthGuard)
  async getTryoutAttemptResult(
    @Req() req: Request,
    @Param('tryout_id') tryout_id: string,
  ) {
    return await this.tryoutHistoryService.getTryoutAttemptResult(
      tryout_id,
      (req.user as any).userId,
    );
  }
}
