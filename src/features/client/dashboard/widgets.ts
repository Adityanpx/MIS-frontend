import type { DashboardWidgetId } from '@/shared/schemas/dashboard';

export type WidgetSpan = 'full' | 'main' | 'side';
export type PreviewKind =
  'kpi' | 'line' | 'list' | 'bars' | 'gauge' | 'cards' | 'table' | 'band' | 'cash' | 'people' | 'shield';

export interface WidgetMeta {
  id: DashboardWidgetId;
  title: string;
  description: string;
  tag: string;
  span: WidgetSpan;
  preview: PreviewKind;
}

/** The "Add widget" catalogue. `span`: full width, main column (1.7fr) or side column (1fr) — DESIGN-SPEC §3. */
export const WIDGETS: Record<DashboardWidgetId, WidgetMeta> = {
  kpis: {
    id: 'kpis',
    title: 'Key figures',
    description: "Today's headline parameters and revenue with MTD change against standard.",
    tag: 'Overview',
    span: 'full',
    preview: 'kpi',
  },
  trend: {
    id: 'trend',
    title: 'Daily trend',
    description: 'This month against last month, day by day, with the standard line and the power split.',
    tag: 'Operations',
    span: 'main',
    preview: 'line',
  },
  alerts: {
    id: 'alerts',
    title: "Today's alerts",
    description: 'Lab exceedances, low stock, expiring guarantees, cash, staff and safety gaps.',
    tag: 'Attention',
    span: 'side',
    preview: 'list',
  },
  last7: {
    id: 'last7',
    title: 'Last 7 days',
    description: 'The focus parameter for the week ending on the report date.',
    tag: 'Operations',
    span: 'side',
    preview: 'bars',
  },
  compliance: {
    id: 'compliance',
    title: 'Outlet compliance',
    description: 'Share of outlet lab tests within limits, month to date or since the MIS start.',
    tag: 'Quality',
    span: 'side',
    preview: 'gauge',
  },
  params: {
    id: 'params',
    title: 'Parameter cards',
    description: 'Every key parameter with Today, MTD, UTD, events and the last five months.',
    tag: 'Operations',
    span: 'full',
    preview: 'cards',
  },
  chemicals: {
    id: 'chemicals',
    title: 'Chemicals',
    description: 'Consumption of every chemical against its standard with the 5-month trend.',
    tag: 'Stock',
    span: 'main',
    preview: 'table',
  },
  quality: {
    id: 'quality',
    title: 'Treated water quality',
    description: 'Outlet results against their limits with events and monthly averages.',
    tag: 'Quality',
    span: 'full',
    preview: 'band',
  },
  cash: {
    id: 'cash',
    title: 'Site cash',
    description: 'Cash in hand and expenses today, this month and to date.',
    tag: 'Finance',
    span: 'side',
    preview: 'cash',
  },
  staff: {
    id: 'staff',
    title: 'Staff today',
    description: 'Present and absent people per category.',
    tag: 'People',
    span: 'side',
    preview: 'people',
  },
  registers: {
    id: 'registers',
    title: 'Guarantees & insurance',
    description: 'Bank guarantees and policies with their validity on the report date.',
    tag: 'Compliance',
    span: 'side',
    preview: 'shield',
  },
};

/** Layout segments: full-width widgets stand alone; main/side widgets in between share a two-column block. */
export type Segment =
  { kind: 'full'; id: DashboardWidgetId } | { kind: 'split'; main: DashboardWidgetId[]; side: DashboardWidgetId[] };

export function toSegments(ids: DashboardWidgetId[]): Segment[] {
  const out: Segment[] = [];
  let cur: { main: DashboardWidgetId[]; side: DashboardWidgetId[] } | null = null;
  for (const id of ids) {
    const span = WIDGETS[id]?.span;
    if (!span) continue;
    if (span === 'full') {
      if (cur) out.push({ kind: 'split', ...cur });
      cur = null;
      out.push({ kind: 'full', id });
    } else {
      cur ??= { main: [], side: [] };
      cur[span].push(id);
    }
  }
  if (cur) out.push({ kind: 'split', ...cur });
  return out;
}
