'use client';

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';
import { EmptyState, Skeleton } from './misc';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
  /** server-side sort key (sends ?sort=key / -key) */
  sortKey?: string;
  className?: string;
  /** hide below this breakpoint */
  hideBelow?: 'sm' | 'md' | 'lg';
}

const hide = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' } as const;

/**
 * The "Best Selling Products" table from the video: 11px UPPERCASE grey headers, ~56px rows separated by
 * DASHED hairlines, numbers right-aligned with tabular figures, rows fade in one after another.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  empty,
  onRowClick,
  sort,
  onSortChange,
  dense,
  stickyHeader,
  className,
  skeletonRows = 6,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T, i: number) => string;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  sort?: string;
  onSortChange?: (sort: string) => void;
  dense?: boolean;
  stickyHeader?: boolean;
  className?: string;
  skeletonRows?: number;
}) {
  const align = (a?: Column<T>['align']) =>
    a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';
  const rowH = dense ? 'h-11' : 'h-14';
  return (
    <div className={cn('scrollbar-thin -mx-1 overflow-x-auto px-1', className)}>
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className={cn(stickyHeader && 'bg-surface sticky top-0 z-10')}>
          <tr>
            {columns.map((c) => {
              const active = sort && c.sortKey && sort.replace(/^-/, '') === c.sortKey;
              const desc = active && sort?.startsWith('-');
              return (
                <th
                  key={c.key}
                  style={{ width: c.width }}
                  className={cn(
                    'border-line text-ink-400 h-10 border-b px-3 text-[11px] font-medium tracking-wider whitespace-nowrap uppercase first:pl-1 last:pr-1',
                    align(c.align),
                    c.hideBelow && hide[c.hideBelow],
                  )}
                >
                  {c.sortKey && onSortChange ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(active && !desc ? `-${c.sortKey}` : c.sortKey!)}
                      className={cn(
                        'hover:text-ink-700 inline-flex items-center gap-1 uppercase',
                        active && 'text-ink-700',
                      )}
                    >
                      {c.header}
                      {active ? (
                        desc ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ArrowUp className="size-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="size-3 opacity-60" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: skeletonRows }, (_, i) => (
              <tr key={`s${i}`}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      rowH,
                      'border-line border-b border-dashed px-3 first:pl-1 last:pr-1',
                      c.hideBelow && hide[c.hideBelow],
                    )}
                  >
                    <Skeleton className={cn('h-3.5', c.align === 'right' ? 'ml-auto w-16' : 'w-3/4')} />
                  </td>
                ))}
              </tr>
            ))}
          {!loading &&
            rows?.map((r, i) => (
              <motion.tr
                key={rowKey(r, i)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03 }}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn('group', onRowClick && 'cursor-pointer')}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      rowH,
                      'border-line text-ink-700 border-b border-dashed px-3 transition-colors group-last:border-b-0 first:pl-1 last:pr-1',
                      onRowClick && 'group-hover:bg-canvas/70',
                      align(c.align),
                      c.align === 'right' && 'tabular',
                      c.hideBelow && hide[c.hideBelow],
                      c.className,
                    )}
                  >
                    {c.cell(r, i)}
                  </td>
                ))}
              </motion.tr>
            ))}
        </tbody>
      </table>
      {!loading && rows && rows.length === 0 && (empty ?? <EmptyState compact title="Nothing here yet" />)}
    </div>
  );
}

/** Server pagination footer: "Showing 26–50 of 1,240" + prev/next pills. */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const btn =
    'grid size-8 place-items-center rounded-full border border-line bg-surface text-ink-700 transition-colors hover:bg-canvas disabled:opacity-40 disabled:hover:bg-surface';
  return (
    <div className={cn('text-ink-500 flex items-center justify-between gap-3 pt-4 text-xs', className)}>
      <span className="tabular">
        Showing {fmtNum(from)}–{fmtNum(to)} of {fmtNum(total)}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={btn}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-ink-700 tabular min-w-14 text-center font-medium">
          {page} / {pages}
        </span>
        <button
          type="button"
          className={btn}
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
