import type { Theme } from './types';

export const FONT_DISPLAY =
  'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';
export const FONT_UI =
  'system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';
export const FONT_MONO =
  'ui-monospace, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace';

export function getTheme(dark: boolean, accent: string): Theme {
  return {
    accent,
    paper: dark ? '#0E0E10' : '#F4F1EA',
    surface: dark ? '#1A1A1D' : '#FFFFFF',
    surface2: dark ? '#222226' : '#FAF8F2',
    ink: dark ? '#F4F1EA' : '#15151A',
    inkSoft: dark ? 'rgba(244,241,234,0.62)' : 'rgba(21,21,26,0.68)',
    inkSofter: dark ? 'rgba(244,241,234,0.38)' : 'rgba(21,21,26,0.50)',
    hairline: dark ? 'rgba(255,255,255,0.08)' : 'rgba(21,21,26,0.08)',
    hairlineStrong: dark ? 'rgba(255,255,255,0.14)' : 'rgba(21,21,26,0.14)',
    success: '#3B7A4B',
    warn: '#C4761A',
    danger: '#B43A3A',
    // Distinct, calm status hues — separate from the burnt-orange brand accent.
    statusPending: dark ? '#D9A441' : '#B0791E',
    statusApproved: dark ? '#6FA0D6' : '#3F6EA8',
    statusPaid: dark ? '#5FA974' : '#3B7A4B',
    statusRejected: dark ? '#D97070' : '#B43A3A',
  };
}

export const ACCENT_OPTIONS = [
  { label: 'Burnt orange', value: '#C8501A' },
  { label: 'Forest', value: '#2D5F3F' },
  { label: 'Ink blue', value: '#1E3A8A' },
  { label: 'Plum', value: '#6B2D5C' },
  { label: 'Graphite', value: '#262626' },
] as const;
