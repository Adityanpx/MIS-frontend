'use client';

import { useParams } from 'next/navigation';
import { AdminSettingsView } from '@/features/admin/settings-view';

export default function Page() {
  const { section } = useParams<{ section?: string[] }>();
  return <AdminSettingsView section={section?.[0]} />;
}
