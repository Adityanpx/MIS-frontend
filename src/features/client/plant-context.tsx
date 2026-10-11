'use client';

import { Factory, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { isApiError } from '@/lib/api';
import { useClientAuth } from '@/lib/auth/client-auth';
import { rememberPlant } from '@/lib/auth/landing';
import { can as canDo, isWriteBlocked, type PlantAction } from '@/lib/permissions';
import type { PlantDetail } from './api-types';
import { usePlantDetail } from './queries';

interface PlantCtx {
  plant: PlantDetail;
  can: (a: PlantAction) => boolean;
  /** true when the API will refuse writes (read-only / expired / suspended / terminated) */
  readOnly: boolean;
}
const Ctx = createContext<PlantCtx | null>(null);

export function usePlant(): PlantCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePlant must be used inside plants/[plantId]/layout');
  return v;
}

/** The plant id in the URL (or undefined outside plant pages). */
export function usePlantIdParam(): string | undefined {
  const p = useParams<{ plantId?: string }>();
  return typeof p.plantId === 'string' ? p.plantId : undefined;
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="rounded-card h-[132px]" />
        ))}
      </div>
      <Skeleton className="rounded-card h-96" />
    </div>
  );
}

/**
 * plants/[plantId]/layout.tsx wraps every plant page in this provider (TRD §8.4):
 * loads GET /plants/:id, exposes plant + can(), remembers it as the default plant, and handles
 * "not found" (also used for other tenants' plants — the API answers 404) and "settings pending".
 */
export function PlantProvider({ children }: { children: ReactNode }) {
  const plantId = usePlantIdParam();
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useClientAuth();
  const q = usePlantDetail(plantId);
  const plant = q.data;

  useEffect(() => {
    if (plant && profile) rememberPlant(profile.user.id, plant.id);
  }, [plant, profile]);

  const isSettingsPath = !!plantId && pathname.startsWith(`/plants/${plantId}/settings`);
  const pending = plant?.setupStatus === 'settings_pending';
  const isCA = plant?.myRole === 'client_admin';

  useEffect(() => {
    if (pending && isCA && !isSettingsPath && plantId) router.replace(`/plants/${plantId}/settings`);
  }, [pending, isCA, isSettingsPath, plantId, router]);

  const value = useMemo<PlantCtx | null>(
    () => (plant ? { plant, can: (a) => canDo(plant.myRole, a), readOnly: isWriteBlocked(plant.accountState) } : null),
    [plant],
  );

  if (q.isLoading || (pending && isCA && !isSettingsPath)) return <PageSkeleton />;
  if (q.isError || !value) {
    const notFound = isApiError(q.error) && q.error.status === 404;
    return (
      <Card>
        <EmptyState
          icon={<Factory />}
          title={notFound ? 'Plant not found' : 'Could not load this plant'}
          description={
            notFound
              ? 'It does not exist or you do not have access to it.'
              : 'Please check your connection and try again.'
          }
          action={
            notFound ? (
              <Button asChild variant="secondary">
                <Link href="/">Back to overview</Link>
              </Button>
            ) : (
              <Button onClick={() => q.refetch()}>Try again</Button>
            )
          }
        />
      </Card>
    );
  }
  if (pending && !isCA) {
    return (
      <Card>
        <EmptyState
          icon={<Settings2 />}
          title="This plant is being set up"
          description="Your Client Admin is completing the plant settings. Logsheets and reports open once the plant goes live."
        />
      </Card>
    );
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
