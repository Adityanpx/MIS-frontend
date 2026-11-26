import { toast } from 'sonner';

/** `subscription.pricePerYear` → "Price per year"; `_` (whole form) → no label. */
function fieldLabel(path: string): string {
  if (path === '_') return '';
  const last = path.split('.').filter((p) => !/^\d+$/.test(p)).pop() ?? path;
  const words = last.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One readable line for a set of field errors, e.g. "Price per year: Required (+1 more)". */
export function errorSummary(errors: Record<string, string>): string | null {
  const entries = Object.entries(errors);
  const first = entries[0];
  if (!first) return null;
  const [path, message] = first;
  const label = fieldLabel(path);
  const more = entries.length > 1 ? ` (+${entries.length - 1} more)` : '';
  return `${label ? `${label}: ` : ''}${message}${more}`;
}

/**
 * Shows why a form could not be submitted, then returns the errors for the inline field messages.
 * The toast makes sure the reason is never invisible, even when the failing field is not on screen
 * (another wizard step, a hidden section, or a field only the server knows about).
 */
export function notifyInvalid(errors: Record<string, string>): Record<string, string> {
  const s = errorSummary(errors);
  if (s) toast.error(`Please check — ${s}`);
  return errors;
}
