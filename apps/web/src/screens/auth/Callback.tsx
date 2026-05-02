import { useEffect, useState } from 'react';
import type { Nav } from '../../lib/router';
import type { Theme } from '../../lib/types';
import { setAuthToken } from '../../lib/api';
import { FONT_DISPLAY, FONT_UI, getTheme } from '../../lib/theme';

interface CallbackProps {
  /** Optional nav — if omitted, the screen falls back to `window.location.replace`. */
  nav?: Nav;
  /** Optional theme — Callback is shown pre-auth, so a default is provided. */
  theme?: Theme;
}

interface ParsedCallback {
  token: string;
  linked: boolean;
  redirect: string;
}

const DEFAULT_REDIRECT = '/';

export function Callback({ nav, theme = getTheme(false, '#262626') }: CallbackProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseCallbackHash(window.location.hash);
    if (parsed === null) {
      setErrorMessage('ลิงก์เข้าสู่ระบบไม่ถูกต้องหรือหมดอายุแล้ว');
      return;
    }

    setAuthToken(parsed.token);

    if (parsed.linked) {
      navigateToPath(parsed.redirect, nav, 'home');
      return;
    }

    navigateToPath('/link-account', nav, 'link-account');
  }, [nav]);

  if (errorMessage !== null) {
    return <CallbackError theme={theme} message={errorMessage} />;
  }

  return <CallbackPending theme={theme} />;
}

function parseCallbackHash(rawHash: string): ParsedCallback | null {
  const hash = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
  if (hash.length === 0) return null;

  const params = new URLSearchParams(hash);
  const token = params.get('token');
  const linkedRaw = params.get('linked');
  const redirect = params.get('redirect') ?? DEFAULT_REDIRECT;

  if (token === null || token.length === 0) return null;
  if (linkedRaw !== 'true' && linkedRaw !== 'false') return null;

  return {
    token,
    linked: linkedRaw === 'true',
    redirect,
  };
}

function navigateToPath(
  path: string,
  nav: Nav | undefined,
  fallbackRouteName: 'home' | 'link-account',
): void {
  if (nav !== undefined) {
    nav({ name: fallbackRouteName });
    return;
  }
  window.location.replace(path);
}

interface CallbackPendingProps {
  theme: Theme;
}

function CallbackPending({ theme }: CallbackPendingProps) {
  return (
    <div
      style={{
        minHeight: '100%',
        background: theme.paper,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          border: `2.5px solid ${theme.accent}33`,
          borderTopColor: theme.accent,
          animation: 'auth-callback-spin 0.8s linear infinite',
        }}
      />
      <div
        style={{
          fontFamily: FONT_UI,
          fontSize: 14,
          color: theme.inkSoft,
        }}
      >
        กำลังเข้าสู่ระบบ...
      </div>
      <style>{`@keyframes auth-callback-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

interface CallbackErrorProps {
  theme: Theme;
  message: string;
}

function CallbackError({ theme, message }: CallbackErrorProps) {
  return (
    <div
      style={{
        minHeight: '100%',
        background: theme.paper,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 28px',
      }}
    >
      <div
        style={{
          fontFamily: FONT_UI,
          fontSize: 11,
          color: theme.danger,
          letterSpacing: 1.4,
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        เกิดข้อผิดพลาด
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: FONT_DISPLAY,
          fontWeight: 400,
          fontSize: 28,
          letterSpacing: -0.4,
          color: theme.ink,
          maxWidth: 320,
          lineHeight: 1.2,
        }}
      >
        ไม่สามารถเข้าสู่ระบบได้
      </h2>
      <div
        style={{
          marginTop: 12,
          fontFamily: FONT_UI,
          fontSize: 14,
          color: theme.inkSoft,
          maxWidth: 320,
          lineHeight: 1.5,
        }}
      >
        {message}
      </div>
      <a
        href="/login"
        style={{
          marginTop: 24,
          fontFamily: FONT_UI,
          fontSize: 14,
          fontWeight: 500,
          color: theme.accent,
          textDecoration: 'none',
        }}
      >
        กลับไปเข้าสู่ระบบ
      </a>
    </div>
  );
}
