'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { Logo } from '@/components/shell/logo';
import { usePublicPlatform } from '@/lib/hooks';
import { env } from '@/lib/env';
import { AuthShowcase } from './auth-showcase';

/** Split screen: form on the left (max 420px), the animated gradient showcase on the right (≥ lg). */
export function AuthLayout({ children, area }: { children: ReactNode; area: 'client' | 'admin' }) {
  const platform = usePublicPlatform();
  const name = platform.data?.name ?? env.appName;
  const year = new Date().getFullYear();
  return (
    <div className="bg-surface grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex min-h-dvh flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo name={name} logoUrl={area === 'client' ? platform.data?.logoUrl : null} />
          {area === 'admin' && (
            <span className="bg-ink-900 rounded-full px-3 py-1 text-[11px] font-semibold tracking-wider text-white uppercase">
              Super Admin
            </span>
          )}
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div
            className="w-full max-w-[420px]"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {children}
          </motion.div>
        </div>
        <div className="text-ink-400 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span>
            © {year} {name}
          </span>
          <span className="flex gap-4">
            {platform.data?.terms.termsUrl && (
              <a href={platform.data.terms.termsUrl} target="_blank" rel="noreferrer" className="hover:text-ink-700">
                Terms
              </a>
            )}
            {platform.data?.terms.privacyUrl && (
              <a href={platform.data.terms.privacyUrl} target="_blank" rel="noreferrer" className="hover:text-ink-700">
                Privacy
              </a>
            )}
            {platform.data?.supportEmail && (
              <a href={`mailto:${platform.data.supportEmail}`} className="hover:text-ink-700">
                Support
              </a>
            )}
          </span>
        </div>
      </div>
      <div className="hidden p-3 lg:block">
        {area === 'client' ? (
          <AuthShowcase
            headline="Every plant, every parameter — one live MIS."
            sub="Daily logsheets become MIS reports, dashboards and signed PDFs automatically. Today, MTD and UTD at a glance."
          />
        ) : (
          <AuthShowcase
            headline="Run the whole platform from one control room."
            sub="Clients, plants, plans, invoices, payments and account health — with every action audited."
          />
        )}
      </div>
    </div>
  );
}

export function AuthHeading({ title, subtitle, icon }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-8">
      {icon && (
        <span className="bg-brand-50 text-brand-500 mb-5 grid size-12 place-items-center rounded-2xl [&_svg]:size-6">
          {icon}
        </span>
      )}
      <h1 className="text-ink-900 text-[28px] font-semibold tracking-[-0.02em]">{title}</h1>
      {subtitle && <p className="text-ink-500 mt-2 text-sm leading-relaxed">{subtitle}</p>}
    </div>
  );
}
