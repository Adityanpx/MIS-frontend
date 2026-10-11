/** Chart colours = the design tokens (Recharts needs raw hex values, not CSS classes). */
export const C = {
  brand: '#2B61F9',
  brandLine: '#2450D6',
  brandSoft: '#B9CDFB',
  grey: '#A3A3AD',
  greyLight: '#C9C9D1',
  grid: '#E8E9EE',
  muted: '#F0F1F5',
  tickOff: '#E3E4EA',
  ink: '#0B0C10',
  inkMid: '#3E3E40',
  success: '#5BCD87',
  successStrong: '#47D986',
  danger: '#E5456F',
  warning: '#ED873D',
  purple: '#7C5CFA',
  teal: '#22C3C3',
  yellow: '#F5B82E',
} as const;

/** Order used for multi-series charts (DESIGN-SPEC §1 "extra colors"). */
export const SERIES_COLOURS = [C.brand, C.success, C.warning, C.purple, C.teal, C.yellow, C.danger, C.grey];

export type Tone = 'brand' | 'success' | 'danger' | 'warning' | 'purple' | 'teal' | 'grey';
export const TONE_HEX: Record<Tone, string> = {
  brand: C.brand,
  success: C.successStrong,
  danger: C.danger,
  warning: C.warning,
  purple: C.purple,
  teal: C.teal,
  grey: C.grey,
};

export const AXIS_TICK = { fill: C.grey, fontSize: 12, fontFamily: 'inherit' } as const;
export const GRID_PROPS = { stroke: C.grid, strokeDasharray: '4 4', vertical: false } as const;
export const ANIM = { isAnimationActive: true, animationDuration: 1000, animationEasing: 'ease-out' as const };

/** SVG ids must not contain ':' (React useId returns ':r1:'). */
export const svgId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '');
