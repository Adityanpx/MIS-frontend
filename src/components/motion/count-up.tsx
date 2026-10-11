'use client';

import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Animated number (stat cards, gauges, hero values). Counts from the previous value to the new one
 * when it scrolls into view, writing straight to the DOM (no React re-render per frame).
 * Pass a formatter so the final text is exactly what fmt*() would print (Indian grouping, ₹, %).
 */
export function CountUp({
  value,
  format = (n) => fmtNum(n, 0),
  duration = 1.1,
  className,
}: {
  value: number | null | undefined;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const reduce = useReducedMotion();
  const formatRef = useRef(format);
  formatRef.current = format;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value === null || value === undefined || !Number.isFinite(value)) {
      el.textContent = '—';
      return;
    }
    if (!inView || reduce) {
      el.textContent = formatRef.current(value);
      if (reduce) from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        el.textContent = formatRef.current(v);
      },
      onComplete: () => {
        el.textContent = formatRef.current(value);
      },
    });
    from.current = value;
    return () => controls.stop();
  }, [value, inView, reduce, duration]);

  return (
    <span ref={ref} className={cn('tabular', className)}>
      {value === null || value === undefined ? '—' : format(value)}
    </span>
  );
}
