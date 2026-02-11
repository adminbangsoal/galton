import { Controller, Get, UseGuards } from '@nestjs/common';
import { TuringGuard } from 'src/authentication/guard/turing.guard';
import SubjectsCmsService from './subjects-cms.service';

@UseGuards(TuringGuard)
@Controller('subjects-cms')
export default class SubjectsCmsController {
  constructor(private readonly subjectsCmsService: SubjectsCmsService) {}

  @Get('subjects')
  async getAllSubjects() {
    return this.subjectsCmsService.getAllSubjects();
  }

  @Get('topics')
  async getAllTopics() {
    return this.subjectsCmsService.getAllTopics();
  }
}
