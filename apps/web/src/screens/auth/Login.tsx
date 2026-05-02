import type { Theme } from '../../lib/types';
import { FONT_DISPLAY, FONT_UI, getTheme } from '../../lib/theme';

const LINE_BRAND_GREEN = '#06C755';
const LINE_LOGIN_REDIRECT = '/api/auth/line/login?redirect=' + encodeURIComponent('/');

interface LoginProps {
  /** Optional theme — Login is shown pre-auth, so a default is provided. */
  theme?: Theme;
}

export function Login({ theme = getTheme(false, '#262626') }: LoginProps) {
  const handleLineLogin = () => {
    window.location.href = LINE_LOGIN_REDIRECT;
  };

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
          ใบเบิกค่าใช้จ่าย
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: FONT_DISPLAY,
            fontWeight: 400,
            fontSize: 38,
            lineHeight: 1.05,
            letterSpacing: -0.6,
            color: theme.ink,
          }}
        >
          เข้าสู่ระบบ
        </h1>
        <div
          style={{
            marginTop: 14,
            maxWidth: 280,
            fontFamily: FONT_UI,
            fontSize: 14,
            color: theme.inkSoft,
            lineHeight: 1.5,
          }}
        >
          เข้าสู่ระบบด้วย LINE เพื่อเริ่มใช้งาน
        </div>
      </div>

      <div style={{ padding: '0 20px 30px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <LineLoginButton onClick={handleLineLogin} />
        <div
          style={{
            fontFamily: FONT_UI,
            fontSize: 12,
            color: theme.inkSoft,
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          ติดต่อผู้ดูแลระบบหากยังไม่มีบัญชี
        </div>
      </div>
    </div>
  );
}

interface LineLoginButtonProps {
  onClick: () => void;
}

function LineLoginButton({ onClick }: LineLoginButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        padding: '15px 22px',
        background: LINE_BRAND_GREEN,
        color: '#fff',
        border: 'none',
        borderRadius: 14,
        fontFamily: FONT_UI,
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: 0.1,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <LineGlyph />
      <span>เข้าสู่ระบบด้วย LINE</span>
    </button>
  );
}

function LineGlyph() {
  return (
    <svg
      viewBox="0 0 36 36"
      width={22}
      height={22}
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
    >
      <rect x="0" y="0" width="36" height="36" rx="8" ry="8" fill="#ffffff" fillOpacity={0.16} />
      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#ffffff"
        fontFamily="Arial, sans-serif"
        fontSize="11"
        fontWeight={700}
        letterSpacing="0.5"
      >
        LINE
      </text>
    </svg>
  );
}
