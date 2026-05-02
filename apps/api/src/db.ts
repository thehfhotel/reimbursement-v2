import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

// Load .env from the repo root before any code touches process.env.
loadEnv({ path: resolve(import.meta.dirname, '../../../.env') });

import { PrismaClient } from './generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
