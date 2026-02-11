import { Module } from '@nestjs/common';
import { drizzleProvider } from 'src/database/drizzle/drizzle.provider';
import SubjectsCmsController from './subjects-cms.controller';
import SubjectsCmsService from './subjects-cms.service';

@Module({
  providers: [SubjectsCmsService, ...drizzleProvider],
  controllers: [SubjectsCmsController],
  imports: [],
})
export default class SubjectsCmsModule {}
