import { Elysia } from 'elysia';
import { prisma } from './db';
import { verifyAuthToken } from './jwt';

const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * JWT-backed authentication plugin.
 *
 * Looks for `Authorization: Bearer <jwt>`, verifies it, and resolves the
 * internal `User` via the `userId` claim. Pre-link tokens (where `userId`
 * is null because the user has not yet entered their 6-digit binding code)
 * are rejected here — those should hit `/api/auth/line/link-account` instead.
 *
 * In dev, we additionally honor `X-Dev-User-Id: <userId>` so the existing
 * tweaks panel "view as employee/approver" toggle keeps working without
 * forcing a real LINE OAuth round-trip during local development. This bypass
 * is hard-disabled when `NODE_ENV=production`.
 */
export const auth = new Elysia({ name: 'auth' }).derive(
  { as: 'scoped' },
  async ({ headers, status }) => {
    if (IS_DEV) {
      const devUserId = headers['x-dev-user-id'];
      if (devUserId) {
        const user = await prisma.user.findUnique({ where: { id: devUserId } });
        if (!user) return status(401, { message: 'Dev user not found' });
        return { user };
      }
    }

    const authz = headers.authorization;
    if (!authz?.startsWith('Bearer ')) {
      return status(401, { message: 'Missing Authorization: Bearer header' });
    }
    const token = authz.slice('Bearer '.length).trim();

    let claims;
    try {
      claims = await verifyAuthToken(token);
    } catch {
      return status(401, { message: 'Invalid or expired token' });
    }

    if (!claims.userId) {
      return status(403, {
        message: 'Account not linked. Submit your 6-digit binding code first.',
      });
    }

    const user = await prisma.user.findUnique({ where: { id: claims.userId } });
    if (!user) {
      return status(401, { message: 'User no longer exists' });
    }

    return { user };
  },
);

/**
 * Looser variant of `auth` that allows pre-link tokens through. Used by
 * the LINE binding endpoint, which needs to authenticate the LINE user
 * even before they have an internal User record.
 */
export const prelinkAuth = new Elysia({ name: 'prelinkAuth' }).derive(
  { as: 'scoped' },
  async ({ headers, status }) => {
    const authz = headers.authorization;
    if (!authz?.startsWith('Bearer ')) {
      return status(401, { message: 'Missing Authorization: Bearer header' });
    }
    const token = authz.slice('Bearer '.length).trim();

    try {
      const claims = await verifyAuthToken(token);
      return { claims };
    } catch {
      return status(401, { message: 'Invalid or expired token' });
    }
  },
);
