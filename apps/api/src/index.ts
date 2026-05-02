import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { prisma } from './db';
import { meRoutes } from './routes/me';
import { receiptRoutes } from './routes/receipts';
import { bundleRoutes } from './routes/bundles';
import { authLineRoutes } from './routes/auth_line';
import { adminRoutes } from './routes/admin';

const PORT = Number(process.env.API_PORT ?? 3001);

const app = new Elysia()
  .use(cors({ origin: true, credentials: true }))
  .use(staticPlugin({ assets: 'uploads', prefix: '/uploads' }))
  .get('/health', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  })
  .get('/', () => ({ name: 'reimbursement-api', version: '0.1.0' }))
  .group('/api', (api) =>
    api
      .use(meRoutes)
      .use(receiptRoutes)
      .use(bundleRoutes)
      .use(authLineRoutes)
      .use(adminRoutes),
  )
  .listen(PORT);

console.log(`API listening on http://localhost:${PORT}`);

export type App = typeof app;
