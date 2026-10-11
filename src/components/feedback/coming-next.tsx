'use client';

import { Hammer } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';

/**
 * Temporary page for routes that later build files replace (so every sidebar link works from File 1).
 * Each later file DELETES the matching placeholder when it adds the real page.
 */
export function ComingNext({ title, file, what }: { title: string; file: number; what: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <EmptyState icon={<Hammer />} title={`Built in frontend File ${file}`} description={what} />
      </Card>
    </>
  );
}

/**
 * Which file builds which path (used by the catch-all placeholders).
 * File 5 built the last pages, so nothing is left: unknown paths now show the 404 page.
 */
export function placeholderFor(_path: string): { title: string; file: number; what: string } | null {
  return null;
}
