import { redirect } from 'next/navigation';

/**
 * Links in the API's e-mails use /plants/:id/logsheets/... (Phase 2 notify.service):
 *   /logsheets/correction-requests → the Corrections page, /logsheets/2026-10-06 → that day's logsheet.
 */
export default async function LogsheetsLinkRedirect({
  params,
}: {
  params: Promise<{ plantId: string; rest?: string[] }>;
}) {
  const { plantId, rest } = await params;
  const first = rest?.[0];
  if (first === 'correction-requests') redirect(`/plants/${plantId}/corrections`);
  if (first && /^\d{4}-\d{2}-\d{2}$/.test(first)) redirect(`/plants/${plantId}/logsheet/${first}`);
  redirect(`/plants/${plantId}/logsheet`);
}
