import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is required');

const JWT_EXPIRY_HOURS = Number(process.env.JWT_EXPIRY_HOURS ?? 24);
const SECRET_BYTES = new TextEncoder().encode(JWT_SECRET);
const ISSUER = 'reimbursement-api';
const AUDIENCE = 'reimbursement-web';

/**
 * Claims carried in app-issued JWTs. Mirrors the fingerprint-time-logger pattern:
 * `lineUserId` is always present after LINE OAuth; `userId` is null until the
 * user binds their LINE account to an internal User record via the 6-digit code.
 */
export interface AuthClaims {
  /** LINE userId (the long `U…` string). Always set. */
  lineUserId: string;
  /** Internal User.id once linked. Null in the pre-link state. */
  userId: string | null;
  /** Pre-link only: the LINE display name to show on the binding page. */
  displayName?: string;
  /** Pre-link only: the LINE picture URL to show on the binding page. */
  pictureUrl?: string;
}

export async function signAuthToken(claims: AuthClaims): Promise<string> {
  return await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(`${JWT_EXPIRY_HOURS}h`)
    .sign(SECRET_BYTES);
}

export async function verifyAuthToken(token: string): Promise<AuthClaims> {
  const { payload } = await jwtVerify(token, SECRET_BYTES, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (typeof payload.lineUserId !== 'string') {
    throw new Error('Token missing lineUserId');
  }
  return {
    lineUserId: payload.lineUserId,
    userId: typeof payload.userId === 'string' ? payload.userId : null,
    displayName: typeof payload.displayName === 'string' ? payload.displayName : undefined,
    pictureUrl: typeof payload.pictureUrl === 'string' ? payload.pictureUrl : undefined,
  };
}
