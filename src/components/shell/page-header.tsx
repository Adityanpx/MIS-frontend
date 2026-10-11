'use client';

import { ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface Crumb {
  label: string;
  href?: string;
}

/** "Dashboard" (28px/600, tight tracking) on the left; date pill, Add widget, Export on the right. */
export function PageHeader({
  title,
  subtitle,
  actions,
  crumbs,
  className,
  badge,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  crumbs?: Crumb[];
  className?: string;
  badge?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn('mb-6 flex flex-col gap-4 lg:mb-8 lg:flex-row lg:items-end lg:justify-between', className)}
    >
      <div className="min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="text-ink-500 mb-2 flex flex-wrap items-center gap-1 text-xs">
            {crumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="inline-flex items-center gap-1">
                {i > 0 && <ChevronRight className="text-ink-300 size-3.5" />}
                {c.href ? (
                  <Link href={c.href} className="hover:text-ink-900">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-ink-700">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-ink-900 text-2xl font-semibold tracking-[-0.02em] sm:text-[28px]">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="text-ink-500 mt-1 text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 sm:gap-3">{actions}</div>}
    </motion.div>
  );
}
