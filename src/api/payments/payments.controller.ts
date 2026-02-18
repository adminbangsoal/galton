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
  async createTransaction(@Body() midtransBody: any, @Req() req: Request) {
    console.log('=== MIDTRANS WEBHOOK RECEIVED ===');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body:', JSON.stringify(midtransBody, null, 2));
    console.log('Transaction Status:', midtransBody?.transaction_status);
    console.log('Order ID:', midtransBody?.order_id);
    console.log('Transaction ID:', midtransBody?.transaction_id);
    
    try {
      const result = await this.paymentsService.createTransaction(midtransBody);
      console.log('=== TRANSACTION PROCESSED SUCCESSFULLY ===');
      return result;
    } catch (error) {
      console.error('=== ERROR PROCESSING TRANSACTION ===');
      console.error('Error:', error);
      console.error('Stack:', error.stack);
      // Still return 200 to Midtrans to prevent retries
      return {
        message: 'Error processing transaction',
        error: error.message,
      };
    }
  }
}
