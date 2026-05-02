import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'prisma/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { resolve } from 'node:path';

// .env lives at the repo root. Best-effort load; on CI it doesn't exist and
// commands that don't need a live DB (e.g. `prisma generate`, `prisma format`)
// shouldn't fail just because there's no .env in sight.
loadEnv({ path: resolve(import.meta.dirname, '../../.env') });

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is required for this Prisma command (check .env at repo root, or set the env var directly)',
    );
  }
  return url;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // datasource.url is consulted only by commands that actually need to talk
  // to the DB (`migrate`, `studio`). `generate` reads the schema and stops.
  datasource: {
    get url(): string {
      return requireDatabaseUrl();
    },
  },
  migrations: {
    path: 'prisma/migrations',
    adapter: () => new PrismaPg({ connectionString: requireDatabaseUrl() }),
  },
});
