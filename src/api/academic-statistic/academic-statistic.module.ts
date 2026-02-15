import { Global, Module } from '@nestjs/common';
import AcademicStatisticController from './academic-statistic.controller';
import { FirebaseModule } from '../../database/firebase/firebase.module';
import { drizzleProvider } from '../../database/drizzle/drizzle.provider';
import AcademicStatisticService from './academic-statistic.service';
import { S3Module } from '../../s3/s3.module';

@Global()
@Module({
  controllers: [AcademicStatisticController],
  providers: [AcademicStatisticService, ...drizzleProvider],
  imports: [FirebaseModule, S3Module],
})
export default class AcademicStatisticModule {}
