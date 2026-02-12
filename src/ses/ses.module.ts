import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import SESService from './ses.service';

@Module({
  imports: [ConfigModule],
  providers: [SESService],
  exports: [SESService],
})
export default class SESModule {}
