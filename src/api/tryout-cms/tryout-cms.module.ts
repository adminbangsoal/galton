import { Module } from '@nestjs/common';
import { TryoutCMSController } from './tryout-cms.controller';

import { drizzleProvider } from '../..//database/drizzle/drizzle.provider';
import TryoutCMSService from './tryout-cms.service';
import { TryoutWorkerModule } from '../../workers/tryout/tryout.module';
import { SupabaseService } from '../../database/supabase/supabase.service';
import { SupabaseModule } from '../../database/supabase/supabase.module';

@Module({
  imports: [TryoutWorkerModule, SupabaseModule],
  providers: [TryoutCMSService, SupabaseService, ...drizzleProvider],
  controllers: [TryoutCMSController],
})
export class TryoutCMSModule {}
