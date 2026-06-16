import { useEffect, useRef, useState } from 'react';
import type { Nav } from '../../lib/router';
import type { Theme } from '../../lib/types';
import { ApiError, api, setAuthToken } from '../../lib/api';
import { FONT_DISPLAY, FONT_UI, getTheme } from '../../lib/theme';
import { PrimaryButton } from '../../components/primitives';

const CODE_LENGTH = 6;
const ONLY_DIGITS = /[^0-9]/g;

/** Contact point shown when the user has no account or needs a new code.
 *  Change to a LINE deep-link, mailto:, or tel: as appropriate. */
const ADMIN_CONTACT = 'mailto:admin@example.com';

/** How long (ms) to show the success state before navigating away. */
const SUCCESS_LINGER_MS = 1600;

interface LinkAccountProps {
  /** Optional nav — if omitted, the screen falls back to `window.location.replace`. */
  nav?: Nav;
  /** Optional theme — LinkAccount is shown pre-auth, so a default is provided. */
  theme?: Theme;
}

export function LinkAccount({ nav, theme = getTheme(false, '#262626') }: LinkAccountProps) {
  const [code, setCode] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState<boolean>(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    api.auth
      .me()
      .then((result) => {
        if (cancelled) return;
        setDisplayName(result.displayName ?? null);
      })
      .catch(() => {
        // Greeting by name is a nice-to-have. Failures here are silently ignored.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    hiddenInputRef.current?.focus();
  }, []);

  // Escape = clear the entered code (a lighter escape than signing out)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && code.length > 0) {
        setCode('');
        setErrorMessage(null);
        hiddenInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [code]);

  const isCodeComplete = code.length === CODE_LENGTH;
  const canSubmit = isCodeComplete && !submitting;

  const handleCodeChange = (next: string) => {
    const digitsOnly = next.replace(ONLY_DIGITS, '').slice(0, CODE_LENGTH);
    setCode(digitsOnly);
    if (errorMessage !== null) {
      setErrorMessage(null);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const response = await api.auth.linkAccount({ code });
      setAuthToken(response.token);
      setSucceeded(true);
      setTimeout(() => {
        if (nav !== undefined) {
          nav({ name: 'home' });
        } else {
          window.location.replace('/');
        }
      }, SUCCESS_LINGER_MS);
    } catch (error) {
      setErrorMessage(messageForError(error));
      // Clear the entered code so the user starts fresh
      setCode('');
      setTimeout(() => hiddenInputRef.current?.focus(), 0);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = () => {
    setAuthToken(null);
    if (nav !== undefined) {
      nav({ name: 'login' });
    } else {
      window.location.replace('/login');
    }
  };

  const greeting = displayName !== null ? `สวัสดี ${displayName} — ` : '';

  // ── Success state — shown briefly before navigating home ─────────
  if (succeeded) {
    return (
      <div
        style={{
          minHeight: '100%',
          background: theme.paper,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          textAlign: 'center',
          padding: '0 28px',
        }}
      >
        {/* Success check chip */}
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: theme.surface2,
            border: `0.5px solid ${theme.hairline}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg
            width={26}
            height={26}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            style={{ display: 'block' }}
          >
            <path
              d="M5 12.5l5 5 9-9"
              stroke={theme.success}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 400,
            fontSize: 24,
            letterSpacing: -0.4,
            color: theme.ink,
            lineHeight: 1.2,
          }}
        >
          เชื่อมต่อบัญชีสำเร็จ
        </div>
        <div
          style={{
            fontFamily: FONT_UI,
            fontSize: 14,
            color: theme.inkSoft,
            lineHeight: 1.5,
          }}
        >
          กำลังเข้าสู่ระบบ...
        </div>
      </div>
    );
  }

  // ── Normal state ─────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: '100%',
        background: theme.paper,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 28px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: FONT_UI,
            fontSize: 11,
            color: theme.inkSoft,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          ครั้งแรก
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: FONT_DISPLAY,
            fontWeight: 400,
            fontSize: 32,
            lineHeight: 1.1,
            letterSpacing: -0.5,
            color: theme.ink,
          }}
        >
          เชื่อมต่อบัญชี LINE
        </h1>
        <div
          style={{
            marginTop: 14,
            maxWidth: 320,
            fontFamily: FONT_UI,
            fontSize: 14,
            color: theme.inkSoft,
            lineHeight: 1.5,
          }}
        >
          {greeting}ป้อนรหัส 6 หลักที่ผู้ดูแลระบบให้คุณ
        </div>

        {errorMessage !== null && (
          <div
            role="alert"
            style={{
              marginTop: 24,
              fontFamily: FONT_UI,
              fontSize: 13,
              fontWeight: 500,
              color: theme.danger,
              maxWidth: 320,
              lineHeight: 1.5,
            }}
          >
            {errorMessage}
          </div>
        )}

        <CodeBoxes
          theme={theme}
          code={code}
          hasError={errorMessage !== null}
          onFocusRequest={() => hiddenInputRef.current?.focus()}
        />

        <input
          ref={hiddenInputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          value={code}
          onChange={(event) => handleCodeChange(event.target.value)}
          aria-label="รหัส 6 หลัก"
          style={{
            position: 'absolute',
            opacity: 0,
            pointerEvents: 'none',
            width: 1,
            height: 1,
          }}
        />
      </div>

      <div style={{ padding: '0 20px 30px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PrimaryButton theme={theme} disabled={!canSubmit} onClick={handleSubmit}>
          {submitting ? 'กำลังยืนยัน...' : 'ยืนยัน'}
        </PrimaryButton>

        {/* Escape options row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            padding: '4px 0',
          }}
        >
          <button
            onClick={handleSignOut}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '8px 10px',
              fontFamily: FONT_UI,
              fontSize: 13,
              color: theme.inkSoft,
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            ออกจากระบบ
          </button>
          <span
            style={{
              fontFamily: FONT_UI,
              fontSize: 13,
              color: theme.hairlineStrong,
              userSelect: 'none',
            }}
          >
            ·
          </span>
          <a
            href={ADMIN_CONTACT}
            style={{
              padding: '8px 10px',
              fontFamily: FONT_UI,
              fontSize: 13,
              color: theme.inkSoft,
              textDecoration: 'underline',
              textDecorationColor: theme.inkSofter,
              textUnderlineOffset: 2,
              cursor: 'pointer',
            }}
          >
            ขอรหัสใหม่
          </a>
        </div>
      </div>
    </div>
  );
}

interface CodeBoxesProps {
  theme: Theme;
  code: string;
  hasError: boolean;
  onFocusRequest: () => void;
}

function CodeBoxes({ theme, code, hasError, onFocusRequest }: CodeBoxesProps) {
  const slots = Array.from({ length: CODE_LENGTH }, (_, index) => code[index] ?? '');
  const activeIndex = code.length < CODE_LENGTH ? code.length : CODE_LENGTH - 1;
  const borderActive = hasError ? theme.danger : theme.ink;

  return (
    <div
      onClick={onFocusRequest}
      style={{
        marginTop: 32,
        display: 'flex',
        gap: 10,
        cursor: 'text',
      }}
    >
      {slots.map((digit, index) => {
        const isFilled = digit !== '';
        const isActive = !isFilled && index === activeIndex;
        return (
          <div
            key={index}
            style={{
              width: 44,
              height: 56,
              borderRadius: 12,
              background: theme.surface,
              border: `1.5px solid ${
                isActive || isFilled ? borderActive : theme.hairlineStrong
              }`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONT_DISPLAY,
              fontSize: 26,
              fontWeight: 500,
              color: theme.ink,
              transition: 'border-color 0.15s ease',
            }}
          >
            {digit}
          </div>
        );
      })}
    </div>
  );
}

function messageForError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'รหัสไม่ถูกต้อง กรุณาตรวจสอบกับผู้ดูแลระบบ';
    if (error.status === 410) return 'รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่';
    if (error.status === 401) return 'หมดอายุการเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่';
    return error.message;
  }
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
}
