import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import UpdateModalCMSService from './update-modal-cms.service';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateUpdateModalDto, DeleteUpdateModalDto } from './update-modal-cms.dto';
import { TuringGuard } from 'src/authentication/guard/turing.guard';

@ApiTags("What's New CMS")
@UseGuards(TuringGuard)
@Controller('update-modal-cms')
export class UpdateModalCMSController {
  constructor(private readonly updateModalCMSService: UpdateModalCMSService) { }

  @ApiBearerAuth()
  @Post('/')
  async createUpdateModal( // yg udh published di CMS, akan nge hit API ini dan UNEDITABLE. harus di delete and create new one
    @Body() data: CreateUpdateModalDto,
  ) {
    return await this.updateModalCMSService.createUpdateModal(data);
  }

  @ApiBearerAuth()
  @Delete('/')
  async deleteUpdateModal(
    @Query() { id }: DeleteUpdateModalDto,
  ) {
    return await this.updateModalCMSService.deleteUpdateModal(id);
  }

}
