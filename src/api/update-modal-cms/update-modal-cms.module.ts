import { Module } from '@nestjs/common';
import { UpdateModalCMSController } from './update-modal-cms.controller';

import { drizzleProvider } from '../../database/drizzle/drizzle.provider';
import UpdateModalCMSService from './update-modal-cms.service';

@Module({
  providers: [UpdateModalCMSService, ...drizzleProvider],
  controllers: [UpdateModalCMSController],
})
export class UpdateModalCMSModule {}
