'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * The sidebar's "Upgrade to Premium" card: diagonal blue→navy gradient, dot-grid texture top-right,
 * white icon tile, bold title, blue-tinted text and a full-width brand pill button.
 * OMMIS: "Plan & billing" (Client Admin), "Need help?" (other users), "Record a payment" (Super Admin).
 */
export function PremiumCard({
  icon,
  title,
  children,
  cta,
  href,
  onClick,
}: {
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  cta: string;
  href?: string;
  onClick?: () => void;
}) {
  const btn =
    'mt-4 flex h-10 w-full items-center justify-center rounded-full bg-brand-500 text-[13px] font-medium text-white shadow-[0_6px_16px_rgb(43_97_249/0.45)] transition-colors hover:bg-brand-400';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.5 }}
      className="bg-premium relative overflow-hidden rounded-2xl p-4 text-white"
    >
      <div className="dot-grid pointer-events-none absolute -top-2 -right-2 size-28 [mask-image:radial-gradient(circle_at_top_right,black,transparent_70%)]" />
      <span className="text-brand-500 relative grid size-8 place-items-center rounded-lg bg-white [&_svg]:size-[18px]">
        {icon}
      </span>
      <p className="relative mt-3 text-[15px] font-semibold">{title}</p>
      {children && <div className="text-brand-200 relative mt-1 text-[11px] leading-relaxed">{children}</div>}
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
