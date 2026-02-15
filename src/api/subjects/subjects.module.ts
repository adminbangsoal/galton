import { Module } from '@nestjs/common';
import { SubjectsService } from './subjects.service';
import { drizzleProvider } from '../../database/drizzle/drizzle.provider';
import { SubjectsController } from './subjects.controller';

@Module({
  controllers: [SubjectsController],
  providers: [SubjectsService, ...drizzleProvider],
  exports: [],
})
export class SubjectsModule {}
