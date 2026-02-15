import { Module } from '@nestjs/common';
import { TryoutController } from './tryout.controller';

import { drizzleProvider } from '../../database/drizzle/drizzle.provider';
import TryoutService from './tryout.service';

@Module({
  providers: [TryoutService, ...drizzleProvider],
  controllers: [TryoutController],
})
export class TryoutModule {}
