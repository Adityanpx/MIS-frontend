'use client';

import { useId } from 'react';
import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtCompact } from '@/lib/format';
import { ChartTooltip } from './chart-tooltip';
import { ANIM, AXIS_TICK, C, GRID_PROPS, svgId } from './theme';

export interface BarDatum {
  label: string;
  value: number | null;
  [k: string]: unknown;
}

/** Cone-shaped bar (the MIS dashboard's "cone" chart type), drawn as a soft triangle with a gradient. */
function coneShape(gradId: string) {
  return function Cone(props: unknown) {
    const {
      x = 0,
      y = 0,
      width = 0,
      height = 0,
    } = props as { x?: number; y?: number; width?: number; height?: number };
    if (!height || height <= 0) return <g />;
    const base = y + height;
    const r = Math.min(4, width / 4);
    const d = `M ${x} ${base} Q ${x} ${base - r} ${x + r * 0.6} ${base - r * 1.6} L ${x + width / 2} ${y} L ${x + width - r * 0.6} ${base - r * 1.6} Q ${x + width} ${base - r} ${x + width} ${base} Z`;
    return <path d={d} fill={`url(#${gradId})`} />;
  };
}

/**
 * Monthly bars (dashboard card charts: type 'bar' and 'cone'). The highlighted bar is solid brand blue,
 * the others light blue; optional dashed STD line. Hover = white tooltip.
 */
export function BarChart({
  data,
  height = 200,
  format = (v) => fmtCompact(v),
  highlight = 'last',
  variant = 'bar',
  reference,
  color = C.brand,
  seriesLabel = 'Value',
  barSize,
  showYAxis = true,
}: {
  data: BarDatum[];
  height?: number;
  format?: (v: number) => string;
  /** which bar is solid: last month, the max, none, or an index */
  highlight?: 'last' | 'max' | 'none' | number;
  variant?: 'bar' | 'cone';
  reference?: { y: number; label?: string };
  color?: string;
  seriesLabel?: string;
  barSize?: number;
  showYAxis?: boolean;
}) {
  const uid = svgId(useId());
  const values = data.map((d) => d.value ?? 0);
  const hi =
    highlight === 'none'
      ? -1
      : highlight === 'last'
        ? (() => {
            for (let i = data.length - 1; i >= 0; i--) if (data[i]?.value !== null) return i;
            return -1;
          })()
        : highlight === 'max'
          ? values.indexOf(Math.max(...values))
          : highlight;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: showYAxis ? 0 : 8 }} barCategoryGap="22%">
          <defs>
            <linearGradient id={`${uid}-on`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.75} />
            </linearGradient>
            <linearGradient id={`${uid}-off`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.brandSoft} stopOpacity={0.9} />
              <stop offset="100%" stopColor={C.brandSoft} stopOpacity={0.45} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            interval="preserveStartEnd"
          />
          {showYAxis && (
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={44}
              tickMargin={6}
              tickFormatter={(v: number) => fmtCompact(v)}
            />
          )}
          <Tooltip
            cursor={{ fill: C.muted, radius: 8 }}
            content={(p) => (
              <ChartTooltip
                active={p.active}
                payload={p.payload}
                label={p.label}
                rows={[{ key: 'value', label: seriesLabel, color }]}
                format={(v) => format(v)}
              />
            )}
          />
          {reference && (
            <ReferenceLine
              y={reference.y}
              stroke={C.danger}
              strokeDasharray="6 4"
              strokeOpacity={0.75}
              label={
                reference.label
                  ? { value: reference.label, position: 'insideTopRight', fill: C.danger, fontSize: 11 }
                  : undefined
              }
            />
          )}
          <Bar
            dataKey="value"
            radius={variant === 'bar' ? [8, 8, 8, 8] : 0}
            barSize={barSize}
            shape={variant === 'cone' ? coneShape(`${uid}-on`) : undefined}
            {...ANIM}
          >
            {data.map((d, i) => (
              <Cell key={d.label} fill={variant === 'cone' || i === hi ? `url(#${uid}-on)` : `url(#${uid}-off)`} />
            ))}
          </Bar>
        </RBarChart>
      </ResponsiveContainer>
    </div>
  );
}
