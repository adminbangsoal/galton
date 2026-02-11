import { Controller, Get, Logger, Param } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Subjects')
@Controller('subjects')
export class SubjectsController {
  private readonly logger = new Logger(SubjectsController.name);
  constructor(private readonly subjectsService: SubjectsService) {}

  @Get('')
  async getAllSubjects() {
    this.logger.log('controller starts getting all subjects');

    const subjects = await this.subjectsService.getAllSubjects();

    this.logger.log('controller successfully got all subjects');

    return subjects
  }

  @Get('/slug/:slug')
  async getSubjectBySlug(@Param('slug') slug: string) {
    this.logger.log(`controller starts getting subject by slug: ${slug}`);

    const subject = await this.subjectsService.getSubjectBySlug(slug);

    this.logger.log(`controller successfully got subject by slug: ${slug}`);

    return subject
  }

  @Get('/topics')
  async getAllTopics() {
    this.logger.log('controller starts getting all topics');
    return await this.subjectsService.getAllTopics();
  }

  @Get('/topics/:subject_id')
  async getTopicById(@Param('subject_id') id: string) {
    this.logger.log(`controller starts getting topics by subject id: ${id}`);
    return await this.subjectsService.getTopicBySubjectId(id);
  }
}
