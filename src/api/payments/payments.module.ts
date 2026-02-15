import { Module } from '@nestjs/common';
import PaymentsController from './payments.controller';
import PaymentsService from './payments.service';
import { drizzleProvider } from '../../database/drizzle/drizzle.provider';
import ReferralModule from '../referral/referral.module';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, ...drizzleProvider],
  imports: [ReferralModule],
})
export default class PaymentsModule {}
