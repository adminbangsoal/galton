import { Controller, Get } from '@nestjs/common';
import PtnService from './ptn.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('PTN')
@Controller('ptn')
export default class PtnController {
  constructor(private readonly ptnService: PtnService) {}

  @Get('')
  async get() {
    return this.ptnService.getAllPtn();
  }
}
