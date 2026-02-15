import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import PaymentsService from './payments.service';
import { CreateSnapDto } from './payments.dto';

import { OnboardingGuard } from '../users/guards/onboarding.guard';
import { JwtAuthGuard } from '../../authentication/guard/jwt.guard';
import { Request } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Payment')
@Controller('payment')
export default class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseGuards(OnboardingGuard)
  @Post('snap')
  async retrieveSnapUrl(@Body() snap: CreateSnapDto, @Req() req: Request) {
    const user = req.user as any;
    return this.paymentsService.retrieveSnapUrl(
      snap.subscription_type,
      user.userId,
      snap?.referal_code,
    );
  }

  @Post('transaction')
  @HttpCode(200)
  async createTransaction(@Body() midtransBody: any) {
    return this.paymentsService.createTransaction(midtransBody);
  }
}
