import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import './globals.css';

/** Inter, self-hosted from @fontsource-variable/inter (no Google request at build or run time). */
const inter = localFont({
  src: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: process.env.NEXT_PUBLIC_APP_NAME ?? 'OMMIS',
    template: `%s · ${process.env.NEXT_PUBLIC_APP_NAME ?? 'OMMIS'}`,
  },
  description: 'O&M MIS for water and wastewater treatment plants',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#F6F7F9', colorScheme: 'light' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
