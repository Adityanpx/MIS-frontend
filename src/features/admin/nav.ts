import {
  Activity,
  BarChart3,
  Building2,
  CalendarClock,
  Factory,
  FileText,
  History,
  LayoutDashboard,
  Layers,
  LogOut,
  ReceiptIndianRupee,
  Settings,
  UserRound,
  Wallet,
} from 'lucide-react';
import type { CommandItem, NavLink, NavSection } from '@/components/shell/types';

/** Super Admin navigation (TRD §7.2). Announcements & notifications are out of scope (decided). */
export const ADMIN_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
      { label: 'Clients', href: '/admin/clients', icon: Building2 },
      { label: 'Plants', href: '/admin/plants', icon: Factory },
      { label: 'Plans', href: '/admin/plans', icon: Layers },
      { label: 'Subscriptions', href: '/admin/subscriptions', icon: CalendarClock },
    ],
  },
  {
    title: 'Finance',
    items: [
      {
        label: 'Finances',
        href: '/admin/finance',
        icon: Wallet,
        match: ['/admin/invoices', '/admin/payments', '/admin/tds'],
        children: [
          { label: 'Invoices', href: '/admin/invoices' },
          { label: 'Payments', href: '/admin/payments' },
          { label: 'TDS & credit', href: '/admin/tds' },
        ],
      },
      { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
      { label: 'Usage', href: '/admin/usage', icon: Activity },
      { label: 'Audit log', href: '/admin/audit', icon: History },
    ],
  },
];

export const ADMIN_BOTTOM: NavLink[] = [{ label: 'Settings', href: '/admin/settings', icon: Settings }];

export function adminCommands(onLogout: () => void): CommandItem[] {
  const pages: CommandItem[] = [];
  for (const s of ADMIN_SECTIONS) {
    for (const it of s.items) {
      if (it.children)
        it.children.forEach((c) =>
          pages.push({ id: c.href, group: 'Go to', label: c.label, icon: it.icon, href: c.href }),
        );
      else pages.push({ id: it.href, group: 'Go to', label: it.label, icon: it.icon, href: it.href });
    }
  }
  return [
    ...pages,
    { id: 'new-client', group: 'Create', label: 'New client', icon: Building2, href: '/admin/clients/new' },
    { id: 'new-plant', group: 'Create', label: 'New plant (wizard)', icon: Factory, href: '/admin/plants/new' },
    {
      id: 'record-payment',
      group: 'Create',
      label: 'Record a payment',
      icon: ReceiptIndianRupee,
      href: '/admin/payments/record',
    },
    { id: 'manual-invoice', group: 'Create', label: 'Manual invoice', icon: FileText, href: '/admin/invoices/new' },
    { id: 'settings', group: 'Account', label: 'Platform settings', icon: Settings, href: '/admin/settings' },
    { id: 'profile', group: 'Account', label: 'My profile', icon: UserRound, href: '/admin/profile' },
    { id: 'logout', group: 'Account', label: 'Sign out', icon: LogOut, action: onLogout },
  ];
}
