import {
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  AddUpdateFeedbackDto,
  AttemptQuestionDto,
  AttemptTimedQuestionDTO,
  ChangeCurrentQuestionDto,
  CreateSequentialQuestionsDto,
  GeneratePDFDto,
  GetAttemptTimedQuestionDto,
  GetTimedQuestionsListBySubjectDto,
  LatihanSoalQuery,
} from './latihan-soal.dto';
import LatihanSoalService from './latihan-soal.service';
import { JwtAuthGuard } from '../../authentication/guard/jwt.guard';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
@ApiTags('Latihan Soal')
@Controller('latihan-soal')
export default class LatihanSoalController {
  constructor(private readonly latihanSoalService: LatihanSoalService) {}
  @ApiQuery({ name: 'topic_id', required: false })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('subject/:subject_id')
  async getLatihanSoalBySubject(
    @Param('subject_id') subject_id: string,
    @Query() { topic_id, question_id, min_year, max_year }: LatihanSoalQuery,
    @Req() req: Request,
  ) {
    return this.latihanSoalService.getLatihanSoal(
      subject_id,
      (req.user as any).userId,
      topic_id,
      question_id,
      min_year,
      max_year,
    );
  }

  @ApiQuery({ name: 'topic_id', required: false })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('history/:subject_id')
  async getAttemptedSubjectCount(
    @Param('subject_id') subject_id: string,
    @Query() { topic_id }: LatihanSoalQuery,
    @Req() req: Request,
  ) {
    return this.latihanSoalService.getAttemptHistories(
      (req.user as any).userId,
      subject_id,
      topic_id,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('attempt/:question_id')
  async attemptQuestion(
    @Param('question_id') question_id: string,
    @Body() body: AttemptQuestionDto,
    @Req() req: Request,
  ) {
    return this.latihanSoalService.attemptQuestion(
      question_id,
      body,
      (req.user as any).userId,
    );
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('attempt/:question_id')
  async getAttemptedQuestion(
    @Req() req: Request,
    @Param('question_id') question_id: string,
  ) {
    return this.latihanSoalService.getAttemptedQuestion(
      question_id,
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('attempt/reset/:subject_id')
  async deleteAttemptedSubject(
    @Req() req: Request,
    @Param('subject_id') subject_id: string,
    @Query() { topic_id, min_year, max_year }: LatihanSoalQuery,
  ) {
    return this.latihanSoalService.resetAttemptedQuestion(
      (req.user as any).userId,
      subject_id,
      topic_id,
      min_year,
      max_year,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('attempt/:question_id')
  async deleteAttemptedQuestion(
    @Req() req: Request,
    @Param('question_id') question_id: string,
  ) {
    return this.latihanSoalService.deleteAttemptedQuestion(
      question_id,
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('pembahasan/:question_id')
  async getPembahasan(
    @Req() req: Request,
    @Param('question_id') question_id: string,
    @Query('attempt_id') attempt_id?: string,
  ) {
    return this.latihanSoalService.getPembahasan(
      question_id,
      (req.user as any).userId,
      attempt_id,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put('submit/:attempt_id')
  async submitAttempt(
    @Req() req: Request,
    @Param('attempt_id') attempt_id: string,
  ) {
    const userId = (req.user as any).userId;

    return this.latihanSoalService.submitAttempt(attempt_id, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('generate-pdf/:subject_id')
  async generatePdf(
    @Body() body: GeneratePDFDto,
    @Req() req: Request,
    @Param('subject_id') subject_id: string,
  ) {
    const userId = (req.user as any).userId;

    return this.latihanSoalService.generatePDF(
      subject_id,
      userId,
      body.topic_id,
      body.min_year,
      body.max_year,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('feedback/:question_id')
  async addFeedback(
    @Req() req: Request,
    @Param('question_id') question_id: string,
    @Body() body: AddUpdateFeedbackDto,
  ) {
    const userId = (req.user as any).userId;

    return this.latihanSoalService.addFeedback(
      question_id,
      userId,
      body.is_like,
      body.feedback,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('feedback/:question_id')
  async getFeedback(
    @Req() req: Request,
    @Param('question_id') question_id: string,
  ) {
    const userId = (req.user as any).userId;

    return this.latihanSoalService.getFeedback(question_id, userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put('feedback/:feedback_id')
  async updateFeedback(
    @Param('feedback_id') feedback_id: string,
    @Body() body: AddUpdateFeedbackDto,
  ) {
    return this.latihanSoalService.updateFeedback(
      feedback_id,
      body.is_like,
      body.feedback,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  @Post('submission-asset/:attempt_id')
  async addSubmissionAsset(
    @Req() req: Request,
    @Param('attempt_id') attempt_id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 1024 * 1024 * 10,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const userId = (req.user as any).userId;

    return this.latihanSoalService.uploadSubmissionAsset(
      file,
      attempt_id,
      userId,
    );
  }

  @Get('pdf/:slug')
  async getPdf(@Param('slug') slug: string) {
    return await this.latihanSoalService.getPdf(slug);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('timed')
  async getCurrentTimedQuestion(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return await this.latihanSoalService.getCurrentTimedQuestion(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('timed/sequential/:subject_id')
  async createSequentialQuestions(
    @Body() body: CreateSequentialQuestionsDto,
    @Req() req: Request,
    @Param('subject_id') subjectId: string,
  ) {
    const userId = (req.user as any).userId;
    return await this.latihanSoalService.createSequentialQuestions(
      body,
      userId,
      subjectId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('timed/sequential')
  async getCurrentSequentialQuestions(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return await this.latihanSoalService.getCurrentSequentialQuestion(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('timed/sequential/next/:sequential_id')
  async submitSequentialQuestion(@Param('sequential_id') sequentialId: string) {
    return await this.latihanSoalService.nextSequentialQuestion(sequentialId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('timed/classic')
  async createClassicTimedQuestion(@Req() req: Request) {
    const userId = (req.user as any).userId;

    return await this.latihanSoalService.createClassicTimedQuestions(userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('timed/classic/:timed_question_id')
  async getTimedQuestionListBySubjectId(
    @Param('timed_question_id') timedQuestionId: string,
    @Req() req: Request,
    @Query() { subject_id: subjectId }: GetTimedQuestionsListBySubjectDto,
  ) {
    return await this.latihanSoalService.getTimedQuestionListBySubjectId(
      timedQuestionId,
      subjectId,
      (req.user as any).userId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('timed/attempt/:timed_question_id')
  async getAttemptedTimedQuestion(
    @Req() req: Request,
    @Param('timed_question_id') timed_question_id: string,
    @Query() query: GetAttemptTimedQuestionDto,
  ) {
    return await this.latihanSoalService.getAttemptedTimedQuestions(
      (req.user as any).userId,
      query.question_id,
      timed_question_id,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put('timed/attempt/:timed_question_id')
  async attemptTimedQuestion(
    @Req() req: Request,
    @Param('timed_question_id') timedQuestionId: string,
    @Body() body: AttemptTimedQuestionDTO,
  ) {
    const userId = (req.user as any).userId;
    return await this.latihanSoalService.attemptTimedQuestion(
      timedQuestionId,
      userId,
      body,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('timed/current-question/:timed_question_id')
  async getCurrentQuestionTimedQuestion(
    @Param('timed_question_id') timedQuestionId: string,
  ) {
    return await this.latihanSoalService.getCurrentQuestionTimedQuestion(
      timedQuestionId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Put('timed/current-question/:timed_question_id')
  async updateTimedQuestionCurrentNumber(
    @Param('timed_question_id') timedQuestionId: string,
    @Query() query: ChangeCurrentQuestionDto,
  ) {
    return await this.latihanSoalService.changeTimedQuestionCurrentQuestion(
      timedQuestionId,
      query,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('timed/submit/:timed_question_id')
  async submitTimedQuestion(
    @Param('timed_question_id') timedQuestionId: string,
  ) {
    return await this.latihanSoalService.submitTimedQuestion(timedQuestionId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('timed/history/:timed_question_id')
  async getTimedQuestionHistory(
    @Param('timed_question_id') timedQuestionId: string,
    @Req() req: Request,
  ) {
    const userId = (req.user as any).userId;
    return await this.latihanSoalService.getTimedQuestionsHistory(
      userId,
      timedQuestionId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('timed/summary/:timed_question_id')
  async getTimedQuestionSummary(
    @Param('timed_question_id') timedQuestionId: string,
    @Req() req: Request,
  ) {
    const userId = (req.user as any).userId;
    return await this.latihanSoalService.getTimedQuestionSummary(
      userId,
      timedQuestionId,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('timed/attempted/:timed_question_id')
  async getAllCurrentAttemptedTimedQuestions(
    @Req() req: Request,
    @Param('timed_question_id') timedQuestionId: string,
  ) {
    return await this.latihanSoalService.getAllCurrentAttemptedTimedQuestion(
      (req.user as any).userId,
      timedQuestionId,
    );
  }

  @Post('turing-pdf/randomize/:topic_id')
  async randomizePDF(@Param('topic_id') topicId: string) {
    return await this.latihanSoalService.randomizePDFTuring(topicId);
  }

  @Get('turing-pdf/:topic_id')
  async getPembahasanPDFTuring(@Param('topic_id') topic_id: string) {
    return await this.latihanSoalService.generateTuringPDF(topic_id);
  }

  @Get('temp-questions/')
  async getTempQuestions() {
    return await this.latihanSoalService.getTempQuestions();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':question_id')
  async getQuestion(
    @Param('question_id') question_id: string,
    @Req() req: Request,
  ) {
    const userId = (req.user as any).userId;
    return await this.latihanSoalService.getLatihanSoalById(
      question_id,
      userId,
    );
  }
}
