import type { Theme } from './types';

export const FONT_DISPLAY = 'Arial, sans-serif';
export const FONT_UI = 'Arial, sans-serif';
export const FONT_MONO = 'Arial, sans-serif';

export function getTheme(dark: boolean, accent: string): Theme {
  return {
    accent,
    paper: dark ? '#0E0E10' : '#F4F1EA',
    surface: dark ? '#1A1A1D' : '#FFFFFF',
    surface2: dark ? '#222226' : '#FAF8F2',
    ink: dark ? '#F4F1EA' : '#15151A',
    inkSoft: dark ? 'rgba(244,241,234,0.62)' : 'rgba(21,21,26,0.55)',
    inkSofter: dark ? 'rgba(244,241,234,0.38)' : 'rgba(21,21,26,0.32)',
    hairline: dark ? 'rgba(255,255,255,0.08)' : 'rgba(21,21,26,0.08)',
    hairlineStrong: dark ? 'rgba(255,255,255,0.14)' : 'rgba(21,21,26,0.14)',
    success: '#3B7A4B',
    warn: '#C4761A',
    danger: '#B43A3A',
  };
}

export const ACCENT_OPTIONS = [
  { label: 'Burnt orange', value: '#C8501A' },
  { label: 'Forest', value: '#2D5F3F' },
  { label: 'Ink blue', value: '#1E3A8A' },
  { label: 'Plum', value: '#6B2D5C' },
  { label: 'Graphite', value: '#262626' },
] as const;
