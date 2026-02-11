import { Module } from '@nestjs/common';
import BangCatatanController from './bang-catatan.controller';
import BangCatatanService from './bang-catatan.service';
import { drizzleProvider } from 'src/database/drizzle/drizzle.provider';
import { S3Module } from 'src/s3/s3.module';
import SESModule from 'src/ses/ses.module';
import { FirebaseModule } from 'src/database/firebase/firebase.module';

@Module({
  imports: [S3Module, SESModule, FirebaseModule],
  controllers: [BangCatatanController],
  providers: [BangCatatanService, ...drizzleProvider],
})
export default class BangCatatanModule {}
