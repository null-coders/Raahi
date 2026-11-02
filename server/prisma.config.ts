// Prisma 7 configuration: where the schema and migrations are, and which database to use.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import { databaseUrl } from './src/db';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: databaseUrl() },
});
