import { Module } from '@nestjs/common';
import PtnController from './ptn.controller';
import PtnService from './ptn.service';

@Module({
  controllers: [PtnController],
  providers: [PtnService],
  imports: [],
})
export default class PtnModule {}
