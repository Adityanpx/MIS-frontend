'use client';

import { Check, ChevronsUpDown, LayoutGrid } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown';
import { Tooltip } from '@/components/ui/popover';
import type { PlantAccess } from '@/lib/auth/types';
import { ROLE_LABEL } from '@/lib/permissions';
import { cn } from '@/lib/utils';

const dot: Record<string, string> = {
  active: 'bg-success-400',
  grace: 'bg-yellow-500',
  read_only: 'bg-warning-500',
  expired: 'bg-warning-500',
  suspended: 'bg-danger-500',
  terminated: 'bg-ink-400',
};

function PlantTile({ code }: { code: string }) {
  return (
    <span className="bg-brand-50 text-brand-500 grid size-9 shrink-0 place-items-center rounded-xl text-[11px] font-bold tracking-wide">
      {code.slice(0, 3).toUpperCase()}
    </span>
  );
}

/**
 * Workspace-style plant switcher at the top of the sidebar. Switching keeps the current section
 * (/plants/A/mis/2026-09-21 → /plants/B/mis/2026-09-21).
 */
export function PlantSwitcher({
  plants,
  current,
  collapsed,
}: {
  plants: PlantAccess[];
  current: PlantAccess | null;
  collapsed: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  if (!current) return null;
  const go = (p: PlantAccess) => {
    const m = /^\/plants\/[^/]+(\/.*)?$/.exec(pathname);
    router.push(`/plants/${p.plantId}${m?.[1] ?? '/dashboard'}`);
  };
  const trigger = (
    <button
      type="button"
      className={cn(
        'border-line bg-canvas hover:border-ink-300 hover:bg-surface flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition-colors',
        collapsed && 'justify-center border-transparent bg-transparent p-1',
      )}
    >
      <PlantTile code={current.code} />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span className="text-ink-900 block truncate text-sm font-semibold">{current.name}</span>
            <span className="text-ink-500 flex items-center gap-1.5 truncate text-xs">
              <span className={cn('size-1.5 rounded-full', dot[current.accountState] ?? 'bg-ink-300')} />
              {current.code} · {ROLE_LABEL[current.role] ?? current.role}
            </span>
          </span>
          <ChevronsUpDown className="text-ink-400 size-4 shrink-0" />
        </>
      )}
    </button>
  );
  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip content={current.name} side="right">
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        </Tooltip>
      ) : (
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      )}
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Your plants</DropdownMenuLabel>
        <div className="scrollbar-thin max-h-72 overflow-y-auto">
          {plants.map((p) => (
            <DropdownMenuItem key={p.plantId} onSelect={() => go(p)} className="h-auto py-2">
              <PlantTile code={p.code} />
              <span className="min-w-0 flex-1">
                <span className="text-ink-900 block truncate text-sm font-medium">{p.name}</span>
                <span className="text-ink-500 flex items-center gap-1.5 text-xs font-normal">
                  <span className={cn('size-1.5 rounded-full', dot[p.accountState] ?? 'bg-ink-300')} />
                  {p.code} ·{' '}
                  {p.setupStatus === 'settings_pending'
                    ? 'Setup pending'
                    : p.setupStatus === 'closed'
                      ? 'Closed'
                      : ROLE_LABEL[p.role]}
                </span>
              </span>
              {p.plantId === current.plantId && <Check className="text-brand-500! size-4" />}
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/')}>
          <LayoutGrid />
          All plants overview
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
