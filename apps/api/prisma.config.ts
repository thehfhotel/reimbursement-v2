import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { resolve } from 'node:path';

// .env lives at the repo root (../..).
loadEnv({ path: resolve(import.meta.dirname, '../../.env') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required (check .env at repo root)');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
  migrations: {
    path: 'prisma/migrations',
    adapter: () => new PrismaPg({ connectionString: databaseUrl }),
  },
});
