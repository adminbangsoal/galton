import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabase: SupabaseClient;
  onModuleInit() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.SUPABASE_KEY || 'placeholder-key',
    );
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }
}
