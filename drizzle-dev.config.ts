import type { Config } from 'drizzle-kit';
const dotenv = require('dotenv')

export default {
  schema: './src/database/schema/**.schema.ts',
  out: './src/database',
  driver: 'pg',
  dbCredentials: {
    connectionString: "postgres://bangsoal:bangsoal2024@database:5432/bs_db",
  },
} as Config;
