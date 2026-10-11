'use client';

import { ExternalLink, FileCheck2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { StateScreen } from '@/components/feedback/screens';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/misc';
import { clientApi, errorMessage } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { landingPath } from '@/lib/auth/landing';
import { usePublicPlatform } from '@/lib/hooks';

/** PRD AUTH-12: a Client Admin accepts the current Terms for the whole company before using the app. */
export default function AcceptTermsPage() {
  const auth = useClientAuth();
  const router = useRouter();
  const platform = usePublicPlatform();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const p = auth.profile;

  useEffect(() => {
    if (p && !p.mustAcceptTerms) router.replace(landingPath(p));
  }, [p, router]);

  const accept = async () => {
    setBusy(true);
    try {
      await clientApi.post('/me/accept-terms');
      const fresh = await auth.reloadProfile();
      toast.success('Thank you. The Terms are accepted for your company.');
      if (fresh) router.replace(landingPath(fresh));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const terms = platform.data?.terms;
  return (
    <StateScreen
      icon={<FileCheck2 />}
      title="Updated Terms of Service"
      actions={
        <>
          <Button variant="ghost" onClick={() => void auth.logout()}>
            Sign out
          </Button>
          <Button disabled={!agreed} loading={busy} onClick={accept}>
            Accept and continue
          </Button>
        </>
      }
    >
      <p>
        Before <b className="text-ink-900">{p?.tenant.displayName}</b> continues, please review and accept version{' '}
        <b className="text-ink-900">{p?.termsVersion || terms?.version}</b> of the Terms.
      </p>
      <div className="mt-4 flex justify-center gap-4 text-[13px] font-medium">
        {terms?.termsUrl && (
          <a
            href={terms.termsUrl}
            target="_blank"
            rel="noreferrer"
            className="text-brand-500 inline-flex items-center gap-1 hover:underline"
          >
            Terms of Service <ExternalLink className="size-3.5" />
          </a>
        )}
        {terms?.privacyUrl && (
          <a
            href={terms.privacyUrl}
            target="_blank"
            rel="noreferrer"
            className="text-brand-500 inline-flex items-center gap-1 hover:underline"
          >
            Privacy Policy <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
      <label className="border-line bg-canvas text-ink-700 mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-left text-[13px]">
        <Checkbox checked={agreed} onCheckedChange={setAgreed} aria-label="I accept" />
        <span>I have read and accept the Terms of Service and Privacy Policy on behalf of my company.</span>
      </label>
    </StateScreen>
  );
}
