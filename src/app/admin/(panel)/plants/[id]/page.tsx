'use client';

import { useParams } from 'next/navigation';
import { PlantDetail } from '@/features/admin/plants-view';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <PlantDetail key={id} id={id} />;
}
