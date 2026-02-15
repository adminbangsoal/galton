import { Module } from '@nestjs/common';
import BangCatatanController from './bang-catatan.controller';
import BangCatatanService from './bang-catatan.service';
import { drizzleProvider } from '../../database/drizzle/drizzle.provider';
import { S3Module } from '../../s3/s3.module';
import SESModule from '../../ses/ses.module';
import { FirebaseModule } from '../../database/firebase/firebase.module';

@Module({
  imports: [S3Module, SESModule, FirebaseModule],
  controllers: [BangCatatanController],
  providers: [BangCatatanService, ...drizzleProvider],
})
export default class BangCatatanModule {}
