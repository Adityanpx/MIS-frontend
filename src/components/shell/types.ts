import type { LucideIcon } from 'lucide-react';

export interface NavLink {
  label: string;
  href: string;
  icon?: LucideIcon;
  /** small pill on the right (e.g. pending corrections, overdue invoices) */
  badge?: number | string | null;
  badgeTone?: 'success' | 'danger' | 'brand' | 'warning';
  /** active when the path starts with href (default) or equals it (exact) */
  exact?: boolean;
  /** extra prefixes that also mark this item active */
  match?: string[];
  children?: Array<Omit<NavLink, 'children' | 'icon'>>;
  disabled?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavLink[];
}

export interface CommandItem {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon?: LucideIcon;
  keywords?: string[];
  href?: string;
  action?: () => void;
}
