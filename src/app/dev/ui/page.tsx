import { notFound } from 'next/navigation';
import { Gallery } from './gallery';

export const metadata = { title: 'UI kit' };

/** Development-only showcase of every component with sample data: /dev/ui (404 in production). */
export default function UiKitPage() {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_APP_ENV !== 'staging') notFound();
  return <Gallery />;
}
