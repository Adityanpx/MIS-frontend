import { fmtDate, fmtDateTime, fmtMoney, fmtNum } from '@/lib/format';
import { cn } from '@/lib/utils';

/** <Money value="70800.00" /> → ₹70,800.00 (money is a string from the API — never parse it into maths). */
export function Money({
  value,
  className,
  signed,
}: {
  value: string | number | null | undefined;
  className?: string;
  signed?: boolean;
}) {
  const n = value === null || value === undefined ? null : Number(value);
  return (
    <span
      className={cn(
        'tabular',
        signed && n !== null && (n < 0 ? 'text-danger-600' : n > 0 ? 'text-success-600' : ''),
        className,
      )}
    >
      {fmtMoney(value)}
    </span>
  );
}

/** <DateText value="2026-09-21" /> → 21-Sep-2026; timestamps → 21-Sep-2026, 14:05 (IST). */
export function DateText({
  value,
  time,
  className,
}: {
  value: string | null | undefined;
  time?: boolean;
  className?: string;
}) {
  return <span className={cn('tabular', className)}>{time ? fmtDateTime(value) : fmtDate(value)}</span>;
}

/** Measurement with its unit: <Qty value={118.4} unit="MLD" decimals={2} />. */
export function Qty({
  value,
  unit,
  decimals,
  className,
}: {
  value: number | string | null | undefined;
  unit?: string | null;
  decimals?: number;
  className?: string;
}) {
  return (
    <span className={cn('tabular', className)}>
      {fmtNum(value, decimals)}
      {unit && value !== null && value !== undefined && <span className="text-ink-500 ml-1">{unit}</span>}
    </span>
  );
}
