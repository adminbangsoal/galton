import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import UpdateModalService from './update-modal.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../authentication/guard/jwt.guard';

@ApiTags("What's New")
@Controller('update-modals')
export class UpdateModalController {
  constructor(private readonly updateModalService: UpdateModalService) {}

  @ApiBearerAuth()
  @Get('/')
  @UseGuards(JwtAuthGuard)
  async getLatestUpdates() {
    return await this.updateModalService.getLatestUpdates();
  }
}
