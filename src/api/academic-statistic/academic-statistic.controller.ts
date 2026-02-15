import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import AcademicStatisticService from './academic-statistic.service';
import { AcademicStatisticDTO } from './academic-statistic.dto';
import { ApiTags } from '@nestjs/swagger';
import { TuringGuard } from '../../authentication/guard/turing.guard';

@ApiTags('Academic Statistic')
@UseGuards(TuringGuard)
@Controller('academic-statistic')
export default class AcademicStatisticController {
  constructor(
    private readonly academicStatisticService: AcademicStatisticService,
  ) {}

  @Get()
  async getAcademicStatistic(
    @Query() academicStatisticDto: AcademicStatisticDTO,
  ) {
    const answered_question =
      await this.academicStatisticService.getAnsweredQuestion(
        academicStatisticDto.year,
        academicStatisticDto.ptn,
      );
    const unanswered_question =
      await this.academicStatisticService.getUnansweredQuestion(
        academicStatisticDto.year,
        academicStatisticDto.ptn,
      );
    const avg_correct_answer =
      await this.academicStatisticService.getAvgCorrectAnswer(
        academicStatisticDto.year,
        academicStatisticDto.ptn,
      );
    const avg_incorrect_answer =
      await this.academicStatisticService.getAvgIncorrectAnswer(
        academicStatisticDto.year,
        academicStatisticDto.ptn,
      );
    const avg_earned_points =
      await this.academicStatisticService.getAvgEarnedPoints(
        academicStatisticDto.year,
        academicStatisticDto.ptn,
      );
    const user_registered_count =
      await this.academicStatisticService.getUserRegisteredCount(
        academicStatisticDto.year,
        academicStatisticDto.ptn,
      );

    return {
      answered_question,
      unanswered_question,
      avg_correct_answer,
      avg_incorrect_answer,
      avg_earned_points,
      user_registered_count,
    };
  }
}
