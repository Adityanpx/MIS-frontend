'use client';

import { notFound, usePathname } from 'next/navigation';
import { ComingNext, placeholderFor } from '@/components/feedback/coming-next';

export default function PlantPlaceholder() {
  const p = placeholderFor(usePathname());
  if (!p) notFound();
  return <ComingNext {...p} />;
}
