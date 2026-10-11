import type { ReactNode } from 'react';
import { PlantProvider } from '@/features/client/plant-context';

export default function PlantLayout({ children }: { children: ReactNode }) {
  return <PlantProvider>{children}</PlantProvider>;
}
