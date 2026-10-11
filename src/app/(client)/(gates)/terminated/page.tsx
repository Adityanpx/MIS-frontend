'use client';

import { Archive } from 'lucide-react';
import Link from 'next/link';
import { StateScreen } from '@/components/feedback/screens';
import { Button } from '@/components/ui/button';
import { useClientAuth } from '@/lib/auth/client-auth';

/** Client Admin of a terminated company: only billing and the data export remain available (PRD §9.2, EXP-01). */
export default function TerminatedPage() {
  const auth = useClientAuth();
  return (
    <StateScreen
      icon={<Archive />}
      tone="warning"
      title="Your subscription has ended"
      actions={
        <>
          <Button asChild variant="secondary">
            <Link href="/company/export">Export my data</Link>
          </Button>
          <Button asChild>
            <Link href="/billing">Open billing</Link>
          </Button>
        </>
      }
    >
      <p>
        <b className="text-ink-900">{auth.profile?.tenant.displayName}</b> is terminated. You can still pay outstanding
        invoices, download receipts and export all your data. Contact us to restart the service.
      </p>
      <button
        type="button"
        onClick={() => void auth.logout()}
        className="text-ink-500 hover:text-ink-900 mt-4 text-[13px] font-medium"
      >
        Sign out
      </button>
    </StateScreen>
  );
}
