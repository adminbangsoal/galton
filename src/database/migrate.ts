import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as postgres from 'postgres';
import * as schema from './schema';

import * as dotenv from 'dotenv';

dotenv.config();

const main = async () => {
  const pg = postgres(process.env.DATABASE_URL);
  const db = drizzle(pg, { schema });

  // This will run migrations on the database, skipping the ones already applied
  await migrate(db, { migrationsFolder: './src/database/migrations' });
  // Don't forget to close the connection, otherwise the script will hang
  await pg.end();
};

main().catch(console.error);
