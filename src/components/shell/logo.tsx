import { cn } from '@/lib/utils';

/** Blue geometric mark (a water drop inside a rounded square) + wordmark. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cn('shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id="ommis-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5A83F8" />
          <stop offset="1" stopColor="#2B61F9" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#ommis-logo)" />
      <path
        d="M16 6.5c3.6 4.3 6.5 7.9 6.5 11.4a6.5 6.5 0 1 1-13 0c0-3.5 2.9-7.1 6.5-11.4Z"
        fill="#fff"
        fillOpacity=".95"
      />
      <path
        d="M12.6 18.6c.9 1.9 2.4 2.8 4.4 2.8"
        stroke="#2B61F9"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({
  name,
  logoUrl,
  collapsed,
  className,
}: {
  name: string;
  logoUrl?: string | null;
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed URL from the API
        <img src={logoUrl} alt="" className="size-8 shrink-0 rounded-[9px] object-contain" />
      ) : (
        <LogoMark />
      )}
      {!collapsed && <span className="text-ink-900 truncate text-xl font-bold tracking-tight">{name}</span>}
    </span>
  );
}
