'use client';

import { Activity, Droplets, ShieldCheck, Zap } from 'lucide-react';
import { motion } from 'motion/react';

/**
 * Right half of the sign-in screens: the premium gradient with floating, gently bobbing widget cards
 * (like the video's floating "Add Widget" cards). Values are illustrative only — no tenant data before sign-in.
 */
const float = (delay: number, rotate: number) => ({
  initial: { opacity: 0, y: 30, rotate },
  animate: { opacity: 1, y: [0, -10, 0], rotate },
  transition: {
    opacity: { duration: 0.6, delay },
    y: { duration: 6, delay, repeat: Infinity, ease: 'easeInOut' as const },
  },
});

const r2 = (n: number) => Math.round(n * 100) / 100;

function MiniGauge({ value }: { value: number }) {
  const ticks = 24;
  const on = Math.round((value / 100) * ticks);
  return (
    <svg viewBox="0 0 120 64" className="w-full">
      {Array.from({ length: ticks }, (_, i) => {
        const a = Math.PI * (1 - i / (ticks - 1));
        return (
          <motion.line
            key={i}
            x1={r2(60 + 38 * Math.cos(a))}
            y1={r2(60 - 38 * Math.sin(a))}
            x2={r2(60 + 52 * Math.cos(a))}
            y2={r2(60 - 52 * Math.sin(a))}
            stroke={i < on ? '#47D986' : '#E3E4EA'}
            strokeWidth={4.5}
            strokeLinecap="round"
            initial={{ opacity: 0 }}
            animate={{ opacity: i < on ? 0.35 + 0.65 * (i / on) : 1 }}
            transition={{ delay: 0.8 + i * 0.03 }}
          />
        );
      })}
    </svg>
  );
}

export function AuthShowcase({ headline, sub }: { headline: string; sub: string }) {
  const bars = [52, 68, 61, 88, 72, 79, 94];
  return (
    <div className="bg-premium relative hidden h-full overflow-hidden rounded-[28px] lg:block">
      <div className="dot-grid absolute top-0 right-0 h-72 w-72 [mask-image:radial-gradient(circle_at_top_right,black,transparent_70%)]" />
      <div className="bg-brand-500/30 absolute -bottom-40 -left-24 size-[420px] rounded-full blur-3xl" />

      <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="text-brand-100 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <Activity className="size-3.5" /> Live O&amp;M MIS
          </span>
          <h2 className="mt-5 max-w-md text-3xl leading-tight font-semibold tracking-tight text-white xl:text-[34px]">
            {headline}
          </h2>
          <p className="text-brand-200 mt-3 max-w-md text-sm leading-relaxed">{sub}</p>
        </motion.div>

        <div className="relative h-[340px]">
          {/* stat card */}
          <motion.div {...float(0.2, -3)} className="shadow-float absolute top-4 left-0 w-60 rounded-2xl bg-white p-4">
            <div className="text-ink-700 flex items-center justify-between text-[13px] font-medium">
              Inflow today <Droplets className="text-brand-500 size-4" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-ink-900 tabular text-2xl font-semibold">118.42</span>
              <span className="text-ink-500 text-xs">MLD</span>
              <span className="bg-success-50 text-success-600 rounded-md px-1.5 py-0.5 text-[11px] font-medium">
                ▲ 2.4%
              </span>
            </div>
            <p className="text-ink-500 mt-1.5 text-[11px]">vs. 115.64 yesterday</p>
          </motion.div>

          {/* pill bars */}
          <motion.div {...float(0.45, 2)} className="shadow-float absolute top-0 right-0 w-56 rounded-2xl bg-white p-4">
            <div className="text-ink-700 flex items-center justify-between text-[13px] font-medium">
              Power, last 7 days <Zap className="text-warning-500 size-4" />
            </div>
            <div className="mt-3 flex h-20 items-end gap-1.5">
              {bars.map((b, i) => (
                <motion.span
                  key={i}
                  className={i === 6 ? 'bg-brand-500 flex-1 rounded-full' : 'bg-muted-bg flex-1 rounded-full'}
                  initial={{ height: 0 }}
                  animate={{ height: `${b}%` }}
                  transition={{ delay: 0.8 + i * 0.06, duration: 0.6 }}
                />
              ))}
            </div>
          </motion.div>

          {/* gauge */}
          <motion.div
            {...float(0.7, -1.5)}
            className="shadow-float absolute bottom-0 left-16 w-56 rounded-2xl bg-white p-4"
          >
            <div className="text-ink-700 flex items-center justify-between text-[13px] font-medium">
              Outlet compliance <ShieldCheck className="text-success-600 size-4" />
            </div>
            <div className="relative mt-2">
              <MiniGauge value={96} />
              <span className="text-ink-900 absolute inset-x-0 bottom-0 text-center text-xl font-bold">96%</span>
            </div>
          </motion.div>

          {/* trend */}
          <motion.div
            {...float(0.95, 2.5)}
            className="shadow-float absolute right-2 bottom-10 w-52 rounded-2xl bg-white p-4"
          >
            <p className="text-ink-700 text-[13px] font-medium">Revenue, MTD</p>
            <p className="text-ink-900 tabular mt-1 text-lg font-semibold">₹38.6 L</p>
            <svg viewBox="0 0 160 44" className="mt-2 w-full">
              <motion.path
                d="M2 38 C 20 30, 30 34, 46 26 S 76 30, 92 18 S 124 20, 140 10 L 158 6"
                fill="none"
                stroke="#2B61F9"
                strokeWidth="2.5"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 1.1, duration: 1.4, ease: 'easeOut' }}
              />
              <path
                d="M2 40 C 22 36, 34 38, 50 33 S 80 35, 96 28 S 126 30, 158 22"
                fill="none"
                stroke="#A3A3AD"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            </svg>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
