'use client';

import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Collapse } from '@/components/motion/primitives';
import { Tooltip } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { NavLink, NavSection } from './types';

export function isActive(pathname: string, l: Pick<NavLink, 'href' | 'exact' | 'match'>): boolean {
  const hit = (h: string) => (l.exact ? pathname === h : pathname === h || pathname.startsWith(`${h}/`));
  return hit(l.href) || !!l.match?.some(hit);
}

const badgeTones = {
  success: 'bg-success-50 text-success-600',
  danger: 'bg-danger-50 text-danger-600',
  brand: 'bg-brand-50 text-brand-500',
  warning: 'bg-warning-50 text-warning-600',
} as const;

function Item({
  item,
  collapsed,
  onNavigate,
  layoutGroup,
}: {
  item: NavLink;
  collapsed: boolean;
  onNavigate?: () => void;
  layoutGroup: string;
}) {
  const pathname = usePathname();
  const childActive = !!item.children?.some((c) => isActive(pathname, c));
  const active = isActive(pathname, item) && !childActive;
  const [open, setOpen] = useState(childActive || isActive(pathname, item));
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);
  const Icon = item.icon;

  const body = (
    <>
      {active && (
        <motion.span
          layoutId={`${layoutGroup}-pill`}
          className="bg-brand-50 absolute inset-0 rounded-xl"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      {active && (
        <motion.span
          layoutId={`${layoutGroup}-bar`}
          className={cn(
            'bg-brand-500 absolute top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r',
            collapsed ? '-left-[18px]' : '-left-4',
          )}
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      {Icon && (
        <Icon
          className={cn(
            'relative size-[18px] shrink-0',
            active || childActive ? 'text-brand-500' : 'text-ink-500 group-hover:text-ink-900',
          )}
          strokeWidth={1.75}
        />
      )}
      {!collapsed && <span className="relative min-w-0 flex-1 truncate">{item.label}</span>}
      {!collapsed && item.badge !== undefined && item.badge !== null && item.badge !== 0 && (
        <span
          className={cn(
            'tabular relative rounded-full px-2 py-0.5 text-[11px] leading-none font-semibold',
            badgeTones[item.badgeTone ?? 'success'],
          )}
        >
          {item.badge}
        </span>
      )}
      {!collapsed && item.children && (
        <ChevronDown
          className={cn('text-ink-400 relative size-4 transition-transform duration-200', open ? 'rotate-180' : '')}
        />
      )}
    </>
  );

  const cls = cn(
    'group relative flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors',
    collapsed && 'justify-center px-0',
    active ? 'text-brand-500' : childActive ? 'text-ink-900' : 'text-ink-700 hover:bg-canvas hover:text-ink-900',
    item.disabled && 'pointer-events-none opacity-40',
  );

  const node = item.children ? (
    <button type="button" className={cls} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
      {body}
    </button>
  ) : (
    <Link href={item.href} className={cls} onClick={onNavigate} aria-current={active ? 'page' : undefined}>
      {body}
    </Link>
  );

  return (
    <li>
      {collapsed ? (
        <Tooltip content={item.label} side="right">
          {node}
        </Tooltip>
      ) : (
        node
      )}
      {item.children && !collapsed && (
        <Collapse open={open}>
          <ul className="border-line relative mt-1 ml-[22px] space-y-0.5 border-l pl-3">
            {item.children.map((c) => {
              const a = isActive(pathname, c);
              return (
                <li key={c.href}>
                  <Link
                    href={c.href}
                    onClick={onNavigate}
                    aria-current={a ? 'page' : undefined}
                    className={cn(
                      'relative flex h-9 items-center gap-2 rounded-lg px-3 text-[13px] font-medium transition-colors',
                      a ? 'text-brand-500' : 'text-ink-500 hover:text-ink-900',
                    )}
                  >
                    {a && (
                      <motion.span
                        layoutId={`${layoutGroup}-child`}
                        className="bg-brand-500 absolute top-1/2 -left-[13px] h-4 w-[2px] -translate-y-1/2 rounded"
                      />
                    )}
                    <span className="truncate">{c.label}</span>
                    {c.badge !== undefined && c.badge !== null && c.badge !== 0 && (
                      <span
                        className={cn(
                          'ml-auto rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold',
                          badgeTones[c.badgeTone ?? 'brand'],
                        )}
                      >
                        {c.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Collapse>
      )}
    </li>
  );
}

/**
 * 256px white sidebar (DESIGN-SPEC §4): logo + collapse icon, sections divided by thin lines, active item =
 * brand-50 pill + 3px blue bar on the far left (both slide between items), collapsible groups with indented
 * children, pinned bottom items and the premium card. Collapses to an 84px icon rail.
 */
export function Sidebar({
  logo,
  top,
  sections,
  bottom,
  card,
  collapsed,
  onToggleCollapse,
  onNavigate,
  layoutGroup = 'nav',
}: {
  logo: ReactNode;
  top?: ReactNode;
  sections: NavSection[];
  bottom?: NavLink[];
  card?: ReactNode;
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  layoutGroup?: string;
}) {
  return (
    <div className="bg-surface flex h-full flex-col">
      <div className={cn('flex h-[72px] shrink-0 items-center justify-between gap-2', collapsed ? 'px-5' : 'px-6')}>
        {logo}
        {onToggleCollapse && !collapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="text-ink-400 hover:bg-muted-bg hover:text-ink-900 grid size-8 place-items-center rounded-lg"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="size-[18px]" />
          </button>
        )}
      </div>
      {collapsed && onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          className="text-ink-400 hover:bg-muted-bg hover:text-ink-900 mx-auto mb-2 grid size-9 place-items-center rounded-lg"
          aria-label="Expand sidebar"
        >
          <PanelLeftOpen className="size-[18px]" />
        </button>
      )}
      {top && <div className={cn('shrink-0 pb-3', collapsed ? 'px-3' : 'px-4')}>{top}</div>}
      <nav
        className={cn('scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto pb-4', collapsed ? 'px-3' : 'px-4')}
        aria-label="Main"
      >
        {sections.map((s, i) => (
          <div key={s.title ?? i} className={cn(i > 0 && 'border-line mt-3 border-t pt-3')}>
            {s.title && !collapsed && (
              <p className="text-ink-400 mb-1.5 px-3 text-[11px] font-medium tracking-wider uppercase">{s.title}</p>
            )}
            <ul className="space-y-0.5">
              {s.items.map((it) => (
                <Item
                  key={it.href + it.label}
                  item={it}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                  layoutGroup={layoutGroup}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>
      {(bottom?.length || card) && (
        <div className={cn('shrink-0 pb-5', collapsed ? 'px-3' : 'px-4')}>
          {bottom && (
            <ul className="mb-3 space-y-0.5">
              {bottom.map((it) => (
                <Item key={it.href} item={it} collapsed={collapsed} onNavigate={onNavigate} layoutGroup={layoutGroup} />
              ))}
            </ul>
          )}
          {!collapsed && card}
        </div>
      )}
    </div>
  );
}
