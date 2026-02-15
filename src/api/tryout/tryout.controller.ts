import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import TryoutService from './tryout.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  StartTryoutDto,
  StartTryoutSetDto,
  SubmitTryoutDto,
  SubmitTryoutSetDto,
  AnswerQuestionDto,
  ToggleQuestionFlagDto,
  TryoutQueryDto,
  UpdateTryoutSetCurrentQuestionDto,
} from './tryout.dto';
import { JwtAuthGuard } from '../../authentication/guard/jwt.guard';

@ApiTags('Tryout')
@Controller('tryouts')
export class TryoutController {
  constructor(private readonly tryoutService: TryoutService) {}

  @ApiBearerAuth()
  @Get('/')
  @UseGuards(JwtAuthGuard)
  async getAllActiveTryouts(
    @Query() { mode, progress }: TryoutQueryDto,
    @Req() req: Request,
  ) {
    return await this.tryoutService.getAllActiveTryouts(
      (req.user as any).userId,
      mode as string,
      progress as string,
    );
  }

  @ApiBearerAuth()
  @Get('/registered')
  @UseGuards(JwtAuthGuard)
  async getRegisteredTryouts(@Req() req: Request) {
    return await this.tryoutService.getRegisteredTryouts(
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @Get('/state')
  @UseGuards(JwtAuthGuard)
  async getTryoutState(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return await this.tryoutService.getCurrentTryoutState(userId);
  }

  @ApiBearerAuth()
  @Get('/sets/:tryout_id/sequence')
  @UseGuards(JwtAuthGuard)
  async getSetSequence(
    @Param('tryout_id') tryoutId: string,
    @Req() req: Request,
  ) {
    return await this.tryoutService.getTryoutSetSequence(tryoutId);
  }

  @ApiBearerAuth()
  @Get('/sets/:set_id/questions')
  @UseGuards(JwtAuthGuard)
  async getAllQuestionsInSet(
    @Param('set_id') set_id: string,
    @Req() req: Request,
  ) {
    return await this.tryoutService.getAllQuestionsInSet(
      set_id,
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @Post('/start')
  @UseGuards(JwtAuthGuard)
  async startTryout(@Req() req: Request, @Body() data: StartTryoutDto) {
    return await this.tryoutService.startTryout(
      data.tryout_id,
      (req.user as any).userId,
      data.event_code,
    );
  }

  @ApiBearerAuth()
  @Put('/sets/:set_id/current-question')
  @UseGuards(JwtAuthGuard)
  async setCurrentNumber(
    @Param('set_id') setId: string,
    @Req() req: Request,
    @Body() { question_id }: UpdateTryoutSetCurrentQuestionDto,
  ) {
    return await this.tryoutService.setAttemptCurrentQuestion(
      setId,
      (req.user as any).userId,
      question_id,
    );
  }

  @ApiBearerAuth()
  @Get('/sets/:set_id/questions/:question_id')
  @UseGuards(JwtAuthGuard)
  async getQuestionDetails(
    @Param('set_id') set_id: string,
    @Param('question_id') question_id: string,
    @Req() req: Request,
  ) {
    return await this.tryoutService.getQuestionDetails(
      set_id,
      question_id,
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @Post('/sets/start')
  @UseGuards(JwtAuthGuard)
  async startTryoutSet(@Req() req: Request, @Body() data: StartTryoutSetDto) {
    return await this.tryoutService.startTryoutSet(
      data.tryout_id,
      (req.user as any).userId,
      data.set_id,
    );
  }

  @ApiBearerAuth()
  @Post('/submit')
  @UseGuards(JwtAuthGuard)
  async submitTryout(@Req() req: Request, @Body() data: SubmitTryoutDto) {
    return await this.tryoutService.submitTryout(
      data.tryout_id,
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @Post('/sets/:set_id/questions')
  @UseGuards(JwtAuthGuard)
  async answerQuestion(
    @Param('set_id') set_id: string,
    @Req() req: Request,
    @Body() data: AnswerQuestionDto,
  ) {
    return await this.tryoutService.answerQuestion(
      set_id,
      (req.user as any).userId,
      data.question_id,
      data.answer,
      data.filled_answers,
    );
  }

  @ApiBearerAuth()
  @Post('/sets/:set_id/questions/flag')
  @UseGuards(JwtAuthGuard)
  async toggleQuestionFlag(
    @Param('set_id') set_id: string,
    @Req() req: Request,
    @Body() data: ToggleQuestionFlagDto,
  ) {
    return await this.tryoutService.toggleQuestionFlag(
      set_id,
      (req.user as any).userId,
      data.question_id,
    );
  }

  @ApiBearerAuth()
  @Post('/sets/submit')
  @UseGuards(JwtAuthGuard)
  async submitTryoutSet(@Req() req: Request, @Body() data: SubmitTryoutSetDto) {
    return await this.tryoutService.submitTryoutSet(
      data.set_id,
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @Get('/:tryout_id')
  @UseGuards(JwtAuthGuard)
  async getTryoutDetails(
    @Param('tryout_id') tryout_id: string,
    @Req() req: Request,
  ) {
    // const userId = (req.user as any).userId;
    return await this.tryoutService.getTryoutDetails(tryout_id);
  }
}
