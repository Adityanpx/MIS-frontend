'use client';

import { useParams } from 'next/navigation';
import { ClientDetail } from '@/features/admin/client-detail';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <ClientDetail key={id} id={id} />;
}
