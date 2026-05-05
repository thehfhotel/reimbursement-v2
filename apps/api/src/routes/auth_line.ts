import { Elysia, t } from 'elysia';
import { randomBytes } from 'node:crypto';
import { prelinkAuth } from '../auth';
import { prisma } from '../db';
import { signAuthToken } from '../jwt';
import { serializeUser } from '../serializers';

/**
 * LINE OAuth 2.0 routes.
 *
 * Mirrors the proven flow from `fingerprint-time-logger`:
 *   GET  /api/auth/login/line      → 302 to LINE authorize endpoint
 *   GET  /api/auth/callback/line   → exchanges code, issues JWT, redirects to web
 *                                    (NextAuth-style path — matches the URL
 *                                     already registered in the LINE Login
 *                                     channel, so no console change needed)
 *   POST /api/auth/link-account    → binds a pre-link JWT to a User via 6-digit code
 *   GET  /api/auth/me              → returns current auth state for the frontend
 */

// ─── LINE API endpoints ──────────────────────────────────────────────────────

const LINE_AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const LINE_PROFILE_URL = 'https://api.line.me/v2/profile';
const LINE_SCOPE = 'profile openid email';

// ─── Env config ──────────────────────────────────────────────────────────────

const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const LINE_REDIRECT_URI = process.env.LINE_REDIRECT_URI;
const WEB_BASE_URL = process.env.WEB_BASE_URL;

interface LineConfig {
  channelId: string;
  channelSecret: string;
  redirectUri: string;
  webBaseUrl: string;
}

/**
 * Resolve LINE OAuth config at request time. We deliberately don't throw at
 * module load so the dev environment can boot without LINE creds wired up.
 */
function getLineConfig(): LineConfig | { missing: string[] } {
  const missing: string[] = [];
  if (!LINE_CHANNEL_ID) missing.push('LINE_CHANNEL_ID');
  if (!LINE_CHANNEL_SECRET) missing.push('LINE_CHANNEL_SECRET');
  if (!LINE_REDIRECT_URI) missing.push('LINE_REDIRECT_URI');
  if (!WEB_BASE_URL) missing.push('WEB_BASE_URL');
  if (missing.length > 0) return { missing };
  return {
    channelId: LINE_CHANNEL_ID as string,
    channelSecret: LINE_CHANNEL_SECRET as string,
    redirectUri: LINE_REDIRECT_URI as string,
    webBaseUrl: WEB_BASE_URL as string,
  };
}

// ─── In-memory state store (CSRF) ────────────────────────────────────────────

interface StateEntry {
  redirect: string;
  createdAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const stateStore = new Map<string, StateEntry>();

function pruneExpiredStates(): void {
  const now = Date.now();
  for (const [state, entry] of stateStore) {
    if (now - entry.createdAt > STATE_TTL_MS) {
      stateStore.delete(state);
    }
  }
}

function generateState(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Validate that a redirect destination is a same-origin relative path. Rejects
 * absolute URLs (anything with a scheme) and protocol-relative URLs (`//evil`).
 */
function isSafeRedirectPath(path: string): boolean {
  if (!path.startsWith('/')) return false;
  if (path.startsWith('//')) return false;
  // Cheap scheme guard — `/foo:bar` is fine, but a colon before any slash isn't.
  // e.g. `javascript:alert(1)` would not start with `/` so already rejected.
  return true;
}

// ─── LINE API helpers ────────────────────────────────────────────────────────

interface LineTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
  id_token?: string;
}

interface LineProfileResponse {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

async function exchangeCodeForToken(
  code: string,
  config: LineConfig,
): Promise<LineTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.channelId,
    client_secret: config.channelSecret,
  });

  const response = await fetch(LINE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`LINE token exchange failed: ${response.status}`);
  }
  return (await response.json()) as LineTokenResponse;
}

async function fetchLineProfile(accessToken: string): Promise<LineProfileResponse> {
  const response = await fetch(LINE_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`LINE profile fetch failed: ${response.status}`);
  }
  return (await response.json()) as LineProfileResponse;
}

function buildAuthorizeUrl(config: LineConfig, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.channelId,
    redirect_uri: config.redirectUri,
    state,
    scope: LINE_SCOPE,
  });
  return `${LINE_AUTHORIZE_URL}?${params.toString()}`;
}

function buildErrorRedirect(webBaseUrl: string, reason: string): string {
  return `${webBaseUrl}/auth/error?reason=${encodeURIComponent(reason)}`;
}

function buildCallbackRedirect(
  webBaseUrl: string,
  token: string,
  linked: boolean,
  redirect: string,
): string {
  const fragment = new URLSearchParams({
    token,
    linked: linked ? 'true' : 'false',
    redirect,
  });
  return `${webBaseUrl}/auth/callback#${fragment.toString()}`;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export const authLineRoutes = new Elysia()
  .group('/auth', (group) =>
    group
      .get(
        '/login/line',
        ({ query, redirect, status }) => {
          const config = getLineConfig();
          if ('missing' in config) {
            return status(500, {
              message: `LINE OAuth not configured. Missing env: ${config.missing.join(', ')}`,
            });
          }

          const requestedRedirect = query.redirect ?? '/';
          if (!isSafeRedirectPath(requestedRedirect)) {
            return status(400, { message: 'Invalid redirect path' });
          }

          pruneExpiredStates();
          const state = generateState();
          stateStore.set(state, { redirect: requestedRedirect, createdAt: Date.now() });

          return redirect(buildAuthorizeUrl(config, state), 302);
        },
        {
          query: t.Object({
            redirect: t.Optional(t.String()),
          }),
        },
      )

      .get(
        '/callback/line',
        async ({ query, redirect }) => {
          const config = getLineConfig();
          if ('missing' in config) {
            // Without WEB_BASE_URL we can't even build an error redirect, so
            // surface the misconfiguration directly.
            const baseForError = WEB_BASE_URL ?? '';
            return redirect(
              `${baseForError}/auth/error?reason=line_not_configured`,
              302,
            );
          }

          if (query.error) {
            return redirect(buildErrorRedirect(config.webBaseUrl, query.error), 302);
          }

          if (!query.code || !query.state) {
            return redirect(
              buildErrorRedirect(config.webBaseUrl, 'missing_code_or_state'),
              302,
            );
          }

          // Validate + consume state (one-time use).
          pruneExpiredStates();
          const stateEntry = stateStore.get(query.state);
          if (!stateEntry) {
            return redirect(
              buildErrorRedirect(config.webBaseUrl, 'invalid_state'),
              302,
            );
          }
          stateStore.delete(query.state);
          if (Date.now() - stateEntry.createdAt > STATE_TTL_MS) {
            return redirect(
              buildErrorRedirect(config.webBaseUrl, 'expired_state'),
              302,
            );
          }

          let profile: LineProfileResponse;
          try {
            const tokenResponse = await exchangeCodeForToken(query.code, config);
            profile = await fetchLineProfile(tokenResponse.access_token);
          } catch {
            return redirect(
              buildErrorRedirect(config.webBaseUrl, 'line_api_error'),
              302,
            );
          }

          const existingUser = await prisma.user.findUnique({
            where: { lineId: profile.userId },
          });

          let token: string;
          let linked: boolean;

          if (existingUser) {
            // Refresh stored display name + picture so they stay current.
            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                lineDisplayName: profile.displayName,
                linePictureUrl: profile.pictureUrl ?? null,
              },
            });
            token = await signAuthToken({
              lineUserId: profile.userId,
              userId: existingUser.id,
            });
            linked = true;
          } else {
            token = await signAuthToken({
              lineUserId: profile.userId,
              userId: null,
              displayName: profile.displayName,
              pictureUrl: profile.pictureUrl,
            });
            linked = false;
          }

          return redirect(
            buildCallbackRedirect(config.webBaseUrl, token, linked, stateEntry.redirect),
            302,
          );
        },
        {
          query: t.Object({
            code: t.Optional(t.String()),
            state: t.Optional(t.String()),
            error: t.Optional(t.String()),
          }),
        },
      )

      .use(prelinkAuth)
      .get('/me', async ({ claims }) => {
        if (claims.userId) {
          const user = await prisma.user.findUnique({ where: { id: claims.userId } });
          if (user) {
            return {
              linked: true as const,
              user: serializeUser(user),
              lineUserId: claims.lineUserId,
              displayName: claims.displayName,
              pictureUrl: claims.pictureUrl,
            };
          }
        }
        return {
          linked: false as const,
          user: null,
          lineUserId: claims.lineUserId,
          displayName: claims.displayName,
          pictureUrl: claims.pictureUrl,
        };
      })
      .post(
        '/link-account',
        async ({ claims, body, status }) => {
          if (claims.userId) {
            return status(400, { message: 'Account is already linked' });
          }

          const code = body.code;
          if (!/^\d{6}$/.test(code)) {
            return status(400, { message: 'Linking code must be 6 digits' });
          }

          const candidate = await prisma.user.findFirst({
            where: {
              lineLinkingCode: code,
              lineLinkingCodeGeneratedAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
              },
            },
          });

          if (!candidate) {
            return status(404, { message: 'Invalid or expired code' });
          }

          if (candidate.lineId) {
            return status(409, {
              message: 'This employee is already linked to a LINE account',
            });
          }

          await prisma.user.update({
            where: { id: candidate.id },
            data: {
              lineId: claims.lineUserId,
              lineDisplayName: claims.displayName ?? null,
              linePictureUrl: claims.pictureUrl ?? null,
              lineLinkingCode: null,
              lineLinkingCodeGeneratedAt: null,
            },
          });

          const token = await signAuthToken({
            lineUserId: claims.lineUserId,
            userId: candidate.id,
          });

          return {
            token,
            linked: true,
            displayName: claims.displayName,
            pictureUrl: claims.pictureUrl,
          };
        },
        {
          body: t.Object({
            code: t.String({ minLength: 6, maxLength: 6 }),
          }),
        },
      ),
  );
