import * as postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from 'src/database/schema';
export const DrizzleAsyncProvider = 'drizzleProvider';
import * as dotenv from 'dotenv';

dotenv.config();

export const drizzleProvider = [
  {
    provide: DrizzleAsyncProvider,
    useFactory: async () => {
      const pg = postgres(process.env.DATABASE_URL);
      const db = drizzle(pg, { schema });

      return db;
    },
    exports: [DrizzleAsyncProvider],
  },
];
