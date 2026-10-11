'use client';

import { useId, type ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtCompact } from '@/lib/format';
import { ChartTooltip } from './chart-tooltip';
import { ANIM, AXIS_TICK, C, GRID_PROPS, SERIES_COLOURS, svgId } from './theme';

export interface TrendSeries {
  key: string;
  label: string;
  color?: string;
  /** dashed grey "previous period" line */
  dashed?: boolean;
  /** fading area under the line (default: only the first, solid series) */
  fill?: boolean;
}

/**
 * The "Total Profit" chart: solid blue line with a fading blue area (this period) and a dashed grey line
 * (previous period). Dashed horizontal grid, dotted vertical hover cursor, white tooltip.
 * Also used for single-series lines (fill:false) and multi-series parameter trends.
 */
export function TrendChart<T extends Record<string, unknown>>({
  data,
  xKey,
  series,
  height = 240,
  format = (v) => fmtCompact(v),
  xFormat,
  yFormat,
  tooltipTitle,
  reference,
  yDomain,
  showYAxis = true,
  minTickGap = 24,
}: {
  data: T[];
  xKey: keyof T & string;
  series: TrendSeries[];
  height?: number;
  format?: (v: number, key: string) => string;
  xFormat?: (v: string) => string;
  yFormat?: (v: number) => string;
  tooltipTitle?: (label: string | number, row: Record<string, unknown>) => ReactNode;
  /** horizontal dashed line, e.g. the daily standard */
  reference?: { y: number; label?: string; color?: string };
  yDomain?: [number | 'auto' | 'dataMin', number | 'auto' | 'dataMax'];
  showYAxis?: boolean;
  minTickGap?: number;
}) {
  const uid = svgId(useId());
  const coloured = series.map((s, i) => ({
    ...s,
    color: s.color ?? (s.dashed ? C.grey : SERIES_COLOURS[i % SERIES_COLOURS.length]),
    fill: s.fill ?? (!s.dashed && i === 0),
  }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: showYAxis ? 0 : 8 }}>
          <defs>
            {coloured.map((s) => (
              <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...GRID_PROPS} />
          <XAxis
            dataKey={xKey}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={minTickGap}
            tickFormatter={xFormat}
          />
          {showYAxis && (
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={48}
              tickMargin={6}
              domain={yDomain ?? ['auto', 'auto']}
              tickFormatter={yFormat ?? ((v: number) => fmtCompact(v))}
            />
          )}
          <Tooltip
            cursor={{ stroke: C.greyLight, strokeWidth: 1.5, strokeDasharray: '3 4' }}
            content={(p) => (
              <ChartTooltip
                active={p.active}
                payload={p.payload}
                label={p.label}
                rows={coloured.map((s) => ({ key: s.key, label: s.label, color: s.color, dashed: s.dashed }))}
                format={format}
                title={tooltipTitle ?? ((l) => (xFormat ? xFormat(String(l)) : String(l)))}
              />
            )}
          />
          {reference && (
            <ReferenceLine
              y={reference.y}
              stroke={reference.color ?? C.danger}
              strokeDasharray="6 4"
              strokeOpacity={0.7}
              label={
                reference.label
                  ? {
                      value: reference.label,
                      position: 'insideTopRight',
                      fill: reference.color ?? C.danger,
                      fontSize: 11,
                    }
                  : undefined
              }
            />
          )}
          {/* dashed series first so the solid line draws on top */}
          {[...coloured]
            .sort((a, b) => Number(!!b.dashed) - Number(!!a.dashed))
            .map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={s.dashed ? 1.75 : 2.25}
                strokeDasharray={s.dashed ? '5 5' : undefined}
                fill={s.fill ? `url(#${uid}-${s.key})` : 'transparent'}
                dot={false}
                activeDot={
                  s.dashed
                    ? { r: 3.5, fill: '#fff', stroke: s.color, strokeWidth: 2 }
                    : { r: 5, fill: '#fff', stroke: s.color, strokeWidth: 2.5 }
                }
                connectNulls
                {...ANIM}
              />
            ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
