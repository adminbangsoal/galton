import { Module } from '@nestjs/common';
import { UpdateModalController } from './update-modal.controller';

import { drizzleProvider } from 'src/database/drizzle/drizzle.provider';
import UpdateModalService from './update-modal.service';

@Module({
  providers: [UpdateModalService, ...drizzleProvider],
  controllers: [UpdateModalController],
})
export class UpdateModalModule {}
