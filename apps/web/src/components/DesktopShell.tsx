import type { ReactNode } from 'react';
import type { Theme } from '../lib/types';

interface DesktopShellProps {
  theme: Theme;
  sidebar: ReactNode;
  children: ReactNode;
}

/**
 * Bare desktop chrome — sidebar + main content. No macOS window decoration.
 * Width fills viewport; height = 100vh so panels can scroll independently.
 */
export function DesktopShell({ theme, sidebar, children }: DesktopShellProps) {
  return (
    <div
      style={{
        height: '100vh',
        width: '100%',
        background: theme.paper,
        color: theme.ink,
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          background: theme.surface2,
          borderRight: `0.5px solid ${theme.hairline}`,
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 0 12px',
          overflowY: 'auto',
        }}
      >
        {sidebar}
      </aside>
      <main
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {children}
      </main>
    </div>
  );
}

interface SidebarItemProps {
  theme: Theme;
  label: string;
  count?: number;
  sub?: string;
  active?: boolean;
  accent?: boolean;
  onClick?: () => void;
}

export function SidebarItem({ theme, label, count, sub, active, accent, onClick }: SidebarItemProps) {
  return (
    <div
      onClick={onClick}
      style={{
        margin: '1px 8px',
        padding: '7px 12px',
        borderRadius: 8,
        cursor: onClick ? 'pointer' : 'default',
        background: active ? 'rgba(0,0,0,0.06)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: 'Arial, sans-serif',
        fontSize: 13,
        color: theme.ink,
        fontWeight: active ? 500 : 400,
      }}
    >
      {accent && <div style={{ width: 6, height: 6, borderRadius: 3, background: theme.warn }} />}
      <span style={{ flex: 1 }}>{label}</span>
      {count != null && (
        <span
          style={{
            fontFamily: 'Arial, sans-serif',
            fontSize: 11,
            color: theme.inkSoft,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {count}
        </span>
      )}
      {sub && <span style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, color: theme.inkSofter }}>{sub}</span>}
    </div>
  );
}

interface SidebarSectionProps {
  label: string;
  theme: Theme;
}

export function SidebarSection({ label, theme }: SidebarSectionProps) {
  return (
    <div
      style={{
        padding: '14px 16px 6px',
        fontFamily: 'Arial, sans-serif',
        fontSize: 10,
        fontWeight: 600,
        color: theme.inkSofter,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  );
}
