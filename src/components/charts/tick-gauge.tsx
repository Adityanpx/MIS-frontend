'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { CountUp } from '@/components/motion/count-up';
import { fmtPct } from '@/lib/format';
import { C, TONE_HEX, type Tone } from './theme';

/**
 * "Repeat Customer Rate" gauge: a semicircle of ~40 short radial ticks. Filled ticks fade lighter toward
 * the start, unfilled ticks are light grey; they light up one by one. Centre: big %, caption, optional action.
 * OMMIS uses it for compliance %, logsheet submission %, plant performance, collection efficiency.
 */
export function TickGauge({
  value,
  ticks = 40,
  tone = 'success',
  caption,
  action,
  target,
  size = 260,
  label,
}: {
  /** 0–100 (clamped) */
  value: number | null;
  ticks?: number;
  tone?: Tone | 'auto';
  caption?: ReactNode;
  action?: ReactNode;
  /** draws a dark marker tick at the target % */
  target?: number;
  size?: number;
  label?: string;
}) {
  const v = value === null ? 0 : Math.max(0, Math.min(100, value));
  const t: Tone = tone === 'auto' ? (v >= 80 ? 'success' : v >= 50 ? 'warning' : 'danger') : tone;
  const colour = TONE_HEX[t];
  const W = 240;
  const H = 128;
  const cx = W / 2;
  const cy = H - 6;
  const r1 = 80;
  const r2 = 104;
  const filled = Math.round((v / 100) * ticks);
  const targetIdx = target === undefined ? -1 : Math.round((Math.max(0, Math.min(100, target)) / 100) * (ticks - 1));

  // rounded so server and browser produce identical SVG (Math.cos differs in the last digits → hydration warning)
  const r = (n: number) => Math.round(n * 100) / 100;
  const line = (i: number, inner = r1, outer = r2) => {
    const a = Math.PI * (1 - i / (ticks - 1));
    return {
      x1: r(cx + inner * Math.cos(a)),
      y1: r(cy - inner * Math.sin(a)),
      x2: r(cx + outer * Math.cos(a)),
      y2: r(cy - outer * Math.sin(a)),
    };
  };

  return (
    <div
      className="mx-auto w-full"
      style={{ maxWidth: size }}
      role="img"
      aria-label={`${label ?? 'Gauge'}: ${fmtPct(value, 0)}`}
    >
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible">
          {Array.from({ length: ticks }, (_, i) => (
            <line key={`b${i}`} {...line(i)} stroke={C.tickOff} strokeWidth={6} strokeLinecap="round" />
          ))}
          {Array.from({ length: filled }, (_, i) => (
            <motion.line
              key={`f${i}`}
              {...line(i)}
              stroke={colour}
              strokeWidth={6}
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 + 0.7 * ((i + 1) / Math.max(1, filled)) }}
              transition={{ duration: 0.25, delay: 0.15 + i * 0.022 }}
            />
          ))}
          {targetIdx >= 0 && (
            <line {...line(targetIdx, r1 - 8, r2 + 6)} stroke={C.ink} strokeWidth={2.5} strokeLinecap="round" />
          )}
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-ink-900 text-[34px] leading-none font-bold tracking-tight">
            {value === null ? '—' : <CountUp value={v} format={(n) => `${Math.round(n)}%`} />}
          </span>
          {caption && <span className="text-ink-500 mt-1.5 text-center text-xs">{caption}</span>}
        </div>
      </div>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}
