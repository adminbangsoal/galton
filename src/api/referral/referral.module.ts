import { Module } from '@nestjs/common';
import { drizzleProvider } from '../../database/drizzle/drizzle.provider';
import ReferralService from './referral.service';
import ReferralController from './referral.controller';

@Module({
  imports: [],
  controllers: [ReferralController],
  providers: [...drizzleProvider, ReferralService],
  exports: [ReferralService],
})
export default class ReferralModule {}
