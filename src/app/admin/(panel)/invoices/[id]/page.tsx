'use client';

import { useParams } from 'next/navigation';
import { InvoiceDetail } from '@/features/admin/invoices-view';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <InvoiceDetail key={id} id={id} />;
}
