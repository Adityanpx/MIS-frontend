/**
 * Every TanStack Query key in one place. Client keys start with 'c', Super Admin keys with 'a',
 * so one sign-out can drop a whole area (queryClient.removeQueries({ queryKey: ['c'] })).
 * Later files ADD keys here; never inline array keys in components.
 */
export const qk = {
  publicPlatform: ['public', 'platform'] as const,
  client: {
    all: ['c'] as const,
    me: ['c', 'me'] as const,
    banners: ['c', 'banners'] as const,
    plants: ['c', 'plants'] as const,
    plant: (plantId: string) => ['c', 'plant', plantId] as const,
    billingSummary: ['c', 'billing', 'summary'] as const,
    // File 2
    overview: ['c', 'overview'] as const,
    dashboard: (plantId: string, date: string | null) =>
      ['c', 'plant', plantId, 'dashboard', date ?? 'latest'] as const,
    mis: (plantId: string, date: string | null) => ['c', 'plant', plantId, 'mis', date ?? 'latest'] as const,
    trend: (plantId: string, param: string, from: string, to: string) =>
      ['c', 'plant', plantId, 'trend', param, from, to] as const,
    layout: (plantId: string) => ['c', 'plant', plantId, 'layout'] as const,
    pdfs: (plantId: string, year: number, month: number) => ['c', 'plant', plantId, 'pdfs', year, month] as const,
    // File 3
    logCalendar: (plantId: string, month: string) => ['c', 'plant', plantId, 'logsheets', 'calendar', month] as const,
    logForm: (plantId: string, date: string) => ['c', 'plant', plantId, 'logsheets', 'form', date] as const,
    logHistory: (plantId: string, date: string) => ['c', 'plant', plantId, 'logsheets', 'history', date] as const,
    corrections: (plantId: string, status: string) => ['c', 'plant', plantId, 'corrections', status] as const,
    settings: (plantId: string, section: string) => ['c', 'plant', plantId, 'settings', section] as const,
    importJob: (plantId: string, id: string) => ['c', 'plant', plantId, 'imports', id] as const,
    // File 4
    report: (plantId: string, slug: string, query: Record<string, unknown>) =>
      ['c', 'plant', plantId, 'report', slug, query] as const,
    exportJob: (id: string) => ['c', 'export', id] as const,
    company: ['c', 'company'] as const,
    users: (query: Record<string, unknown>) => ['c', 'company', 'users', query] as const,
    audit: (query: Record<string, unknown>) => ['c', 'company', 'audit', query] as const,
    companyExports: ['c', 'company', 'exports'] as const,
    billing: (part: string, query?: Record<string, unknown>) => ['c', 'billing', part, query ?? {}] as const,
    invoice: (id: string) => ['c', 'billing', 'invoice', id] as const,
  },
  admin: {
    all: ['a'] as const,
    me: ['a', 'me'] as const,
    // File 5: one key per API path + query, e.g. ['a', '/clients', { page: 1 }]
    r: (path: string, query?: Record<string, unknown>) => ['a', path, query ?? {}] as const,
  },
};
