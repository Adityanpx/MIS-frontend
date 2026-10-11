'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Compact sidebar shortcut: icon chip + one-line label + a small pill button, all in one row.
 * OMMIS: "Plan & billing" (Client Admin), "Need help?" (other users), "Record a payment" (Super Admin).
 */
export function PremiumCard({
  icon,
  title,
  cta,
  href,
  onClick,
}: {
  icon: ReactNode;
  title: ReactNode;
  cta: string;
  href?: string;
  onClick?: () => void;
}) {
  const btn =
    'shrink-0 flex h-7 items-center rounded-full bg-brand-500 px-3 text-[11px] font-medium text-white transition-colors hover:bg-brand-400';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.4 }}
      className="bg-premium flex items-center gap-2 rounded-xl p-2 text-white"
    >
      <span className="text-brand-500 grid size-6 shrink-0 place-items-center rounded-md bg-white [&_svg]:size-3.5">
        {icon}
      </span>
      <p className="min-w-0 flex-1 truncate text-[12px] font-medium">{title}</p>
      {href ? (
        <Link href={href} className={btn}>
          {cta}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={btn}>
          {cta}
        </button>
      )}
    </motion.div>
  );
}
