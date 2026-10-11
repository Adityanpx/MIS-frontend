'use client';

import { useParams } from 'next/navigation';
import { AdminReportsView } from '@/features/admin/reports-view';

export default function Page() {
  const { key } = useParams<{ key?: string[] }>();
  return <AdminReportsView slug={key?.[0]} />;
}
