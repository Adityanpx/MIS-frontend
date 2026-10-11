import {
  BarChart3,
  Building2,
  ClipboardList,
  Download,
  FilePenLine,
  FileSpreadsheet,
  FileText,
  Gauge,
  History,
  LayoutGrid,
  LogOut,
  Settings,
  SlidersHorizontal,
  Table2,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import type { CommandItem, NavLink, NavSection } from '@/components/shell/types';
import type { ClientProfile, PlantAccess } from '@/lib/auth/types';
import { can } from '@/lib/permissions';

/** The 7 plant reports (PRD RPT-01…12), each a page in File 4. */
export const REPORTS = [
  { slug: 'monthly', label: 'Monthly report' },
  { slug: 'custom', label: 'Custom range' },
  { slug: 'trend', label: 'Parameter trend' },
  { slug: 'stock-ledger', label: 'Stock ledger' },
  { slug: 'cash-book', label: 'Cash book' },
  { slug: 'lab-compliance', label: 'Lab compliance' },
  { slug: 'submissions', label: 'Logsheet submissions' },
] as const;

export function plantLinks(plant: PlantAccess): NavLink[] {
  const base = `/plants/${plant.plantId}`;
  const role = plant.role;
  const links: NavLink[] = [
    { label: 'Dashboard', href: `${base}/dashboard`, icon: Gauge },
    { label: 'MIS report', href: `${base}/mis`, icon: Table2 },
    { label: 'Daily logsheet', href: `${base}/logsheet`, icon: ClipboardList },
    {
      label: 'Reports',
      href: `${base}/reports`,
      icon: BarChart3,
      children: REPORTS.map((r) => ({ label: r.label, href: `${base}/reports/${r.slug}` })),
    },
    { label: 'PDF archive', href: `${base}/pdfs`, icon: FileText },
  ];
  if (can(role, 'corrections.manage'))
    links.push({ label: 'Corrections', href: `${base}/corrections`, icon: FilePenLine });
  if (can(role, 'settings.view'))
    links.push({ label: 'Plant settings', href: `${base}/settings`, icon: SlidersHorizontal });
  if (can(role, 'imports.manage'))
    links.push({ label: 'Excel import', href: `${base}/imports`, icon: FileSpreadsheet });
  return links;
}

export function clientNav(
  profile: ClientProfile,
  plant: PlantAccess | null,
): { sections: NavSection[]; bottom: NavLink[] } {
  const isCA = profile.user.isClientAdmin;
  const sections: NavSection[] = [{ items: [{ label: 'Overview', href: '/', icon: LayoutGrid, exact: true }] }];
  if (plant) sections.push({ title: 'Plant', items: plantLinks(plant) });
  if (isCA) {
    sections.push({
      title: 'Company',
      items: [
        { label: 'Users & roles', href: '/company/users', icon: Users },
        { label: 'Company profile', href: '/company', icon: Building2, exact: true },
        {
          label: 'Billing',
          href: '/billing',
          icon: Wallet,
          children: [
            { label: 'Overview', href: '/billing', exact: true },
            { label: 'Invoices', href: '/billing/invoices' },
            { label: 'Payments & receipts', href: '/billing/payments' },
            { label: 'Subscriptions', href: '/billing/subscriptions' },
          ],
        },
        { label: 'Audit log', href: '/company/audit', icon: History },
        { label: 'Data export', href: '/company/export', icon: Download },
      ],
    });
  }
  return { sections, bottom: [{ label: 'My profile', href: '/profile', icon: Settings }] };
}

/** ⌘K items for the client area. */
export function clientCommands(profile: ClientProfile, onLogout: () => void): CommandItem[] {
  const items: CommandItem[] = [{ id: 'home', group: 'Go to', label: 'Overview', icon: LayoutGrid, href: '/' }];
  for (const p of profile.plants.filter((x) => x.setupStatus !== 'closed')) {
    for (const l of plantLinks(p)) {
      items.push({
        id: `${p.plantId}-${l.href}`,
        group: p.name,
        label: l.label,
        hint: p.code,
        icon: l.icon,
        href: l.href,
        keywords: [p.name, p.code],
      });
      for (const c of l.children ?? []) {
        items.push({
          id: `${p.plantId}-${c.href}`,
          group: p.name,
          label: c.label,
          hint: p.code,
          icon: l.icon,
          href: c.href,
          keywords: [p.name, 'report'],
        });
      }
    }
  }
  if (profile.user.isClientAdmin) {
    items.push(
      { id: 'users', group: 'Company', label: 'Users & roles', icon: Users, href: '/company/users' },
      { id: 'company', group: 'Company', label: 'Company profile', icon: Building2, href: '/company' },
      {
        id: 'billing',
        group: 'Company',
        label: 'Billing & invoices',
        icon: Wallet,
        href: '/billing',
        keywords: ['pay', 'invoice'],
      },
      { id: 'audit', group: 'Company', label: 'Audit log', icon: History, href: '/company/audit' },
    );
  }
  items.push(
    { id: 'profile', group: 'Account', label: 'My profile', icon: UserRound, href: '/profile' },
    { id: 'logout', group: 'Account', label: 'Sign out', icon: LogOut, action: onLogout },
  );
  return items;
}
