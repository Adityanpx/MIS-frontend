import { Compass } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="bg-canvas grid min-h-dvh place-items-center p-4">
      <div className="border-line bg-surface shadow-card w-full max-w-md rounded-3xl border p-8 text-center">
        <span className="bg-brand-50 text-brand-500 mx-auto grid size-14 place-items-center rounded-2xl">
          <Compass className="size-7" />
        </span>
        <p className="text-ink-900 mt-5 text-5xl font-bold tracking-tight">404</p>
        <h1 className="text-ink-900 mt-2 text-lg font-semibold">Page not found</h1>
        <p className="text-ink-500 mt-1 text-sm">The page you are looking for does not exist or was moved.</p>
        <Link
          href="/"
          className="bg-brand-500 hover:bg-brand-600 mt-6 inline-flex h-10 items-center rounded-full px-5 text-sm font-medium text-white"
        >
          Go to overview
        </Link>
      </div>
    </div>
  );
}
