'use client';

import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const EXCEPTION_LABELS: Record<string, string> = {
  missing_logsheet: 'Missing logsheet',
  outlet_exceeded: 'Outlet limit exceeded',
  stock_below_min: 'Stock below minimum',
  critical_breakdown: 'Critical breakdown open',
  breakdown_overdue: 'Breakdown overdue',
  register_expiring: 'BG / insurance expiring',
  account_restricted: 'Account in Grace / Read-only / Suspended',
};

interface Exception {
  plantId: string;
  type: string;
  detail: string;
}

interface Group {
  type: string;
  label: string;
  items: Exception[];
}

function groupExceptions(exceptions: Exception[]): Group[] {
  const map = new Map<string, Exception[]>();
  for (const ex of exceptions) {
    const list = map.get(ex.type) ?? [];
    list.push(ex);
    map.set(ex.type, list);
  }
  return Array.from(map.entries()).map(([type, items]) => ({
    type,
    label: EXCEPTION_LABELS[type] ?? type,
    items,
  }));
}

export function ExceptionsPanel({
  exceptions,
  exceptionsOnly,
  onToggle,
}: {
  exceptions: Exception[];
  exceptionsOnly: boolean;
  onToggle: (on: boolean) => void;
}) {
  const groups = groupExceptions(exceptions);

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm font-medium text-danger-600">
          <AlertTriangle className="size-4" />
          <span>{exceptions.length} exception{exceptions.length !== 1 ? 's' : ''} today</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onToggle(false)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              !exceptionsOnly
                ? 'bg-ink-900 text-white'
                : 'bg-muted-bg text-ink-600 hover:bg-muted-bg/80',
            )}
          >
            All plants
          </button>
          <button
            type="button"
            onClick={() => onToggle(true)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              exceptionsOnly
                ? 'bg-danger-600 text-white'
                : 'bg-muted-bg text-ink-600 hover:bg-muted-bg/80',
            )}
          >
            Exceptions only
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <div key={g.type} className="flex items-center gap-1.5">
            <Badge tone="danger" size="sm">
              {g.items.length}
            </Badge>
            <span className="text-xs text-ink-600">{g.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
