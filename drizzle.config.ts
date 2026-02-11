import type { Config } from 'drizzle-kit';
const dotenv = require('dotenv')

dotenv.config()

export default {
  schema: './src/database/schema/**.schema.ts',
  out: './src/database/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL,
  },
} as Config;
