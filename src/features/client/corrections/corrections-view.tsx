'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, ClipboardList, FilePenLine, Inbox, ShieldAlert, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shell/page-header';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { Avatar, EmptyState, Skeleton } from '@/components/ui/misc';
import { Segmented } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/api';
import { DASH, fmtDate, fmtDateTime, fmtNum, fmtRelative } from '@/lib/format';
import { qk } from '@/lib/query/keys';
import { weekday } from '../engine-ui';
import { usePlant } from '../plant-context';
import { allFields } from '../logsheet/form-engine';
import { invalidatePlantData, logApi, useCorrectionRequests, useLogForm } from '../logsheet/queries';
import type { CorrectionRequest } from '../logsheet/types';

type Status = CorrectionRequest['status'];
const show = (v: unknown) =>
  v === null || v === undefined || v === '' ? DASH : typeof v === 'number' ? fmtNum(v) : String(v);

/** Old → new for every proposed value (names and current values come from that day's form). */
function ChangeTable({ plantId, req }: { plantId: string; req: CorrectionRequest }) {
  const q = useLogForm(plantId, req.date);
  if (q.isLoading) return <Skeleton className="rounded-inner h-24" />;
  const fields = q.data ? allFields(q.data) : [];
  return (
    <div className="rounded-inner border-line overflow-hidden border">
      <table className="w-full text-[13px]">
        <thead className="bg-canvas">
          <tr className="text-ink-400 text-left text-[11px] font-medium tracking-wider uppercase">
            <th className="px-3.5 py-2">Parameter</th>
            <th className="px-3.5 py-2 text-right">{req.status === 'pending' ? 'Now' : 'Before'}</th>
            <th className="px-3.5 py-2 text-right">Proposed</th>
          </tr>
        </thead>
        <tbody className="divide-line divide-y">
          {req.proposed.map((p) => {
            const f = fields.find((x) => x.parameterId === p.parameterId);
            return (
              <tr key={p.parameterId}>
                <td className="text-ink-700 px-3.5 py-2">
                  {f?.name ?? 'Parameter'}
                  {f?.unit && f.unit !== 'text' && <span className="text-ink-400 ml-1 text-[11px]">{f.unit}</span>}
                </td>
                <td className="text-ink-400 tabular px-3.5 py-2 text-right line-through">
                  {req.status === 'pending' ? show(q.data?.values[p.parameterId]) : DASH}
                </td>
                <td className="text-brand-600 tabular px-3.5 py-2 text-right font-semibold">{show(p.value)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RequestCard({
  req,
  plantId,
  onDecide,
}: {
  req: CorrectionRequest;
  plantId: string;
  onDecide: (approve: boolean) => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
    >
      <Card>
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={req.requested_by} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/plants/${plantId}/logsheet/${req.date}`}
                className="text-ink-900 hover:text-brand-500 text-base font-semibold"
              >
                Logsheet of {weekday(req.date)} {fmtDate(req.date)}
              </Link>
              <StatusBadge status={req.status} size="sm" />
            </div>
            <p className="text-ink-500 text-xs">
              Requested by {req.requested_by} · {fmtRelative(req.created_at)} · {req.proposed.length} value
              {req.proposed.length > 1 ? 's' : ''}
            </p>
          </div>
          {req.status === 'pending' && (
            <div className="flex gap-2">
              <Button variant="danger-soft" onClick={() => onDecide(false)}>
                <X /> Reject
              </Button>
              <Button onClick={() => onDecide(true)}>
                <Check /> Approve
              </Button>
            </div>
          )}
        </div>
        <p className="rounded-inner bg-canvas text-ink-700 mt-4 px-4 py-3 text-sm italic">“{req.reason}”</p>
        <div className="mt-4">
          <ChangeTable plantId={plantId} req={req} />
        </div>
        {req.status !== 'pending' && (
          <p className="text-ink-500 mt-3 text-xs">
            {req.status === 'approved' ? 'Approved' : 'Rejected'} by {req.decided_by ?? '—'} ·{' '}
            {fmtDateTime(req.decided_at)}
            {req.comment && <span className="text-ink-700"> — “{req.comment}”</span>}
          </p>
        )}
      </Card>
    </motion.div>
  );
}

/** Client Admin queue of correction requests (LOG-19/20). */
export function CorrectionsView() {
  const { plant, can, readOnly } = usePlant();
  const [status, setStatus] = useState<Status>('pending');
  const q = useCorrectionRequests(plant.id, status);
  const pending = useCorrectionRequests(plant.id, 'pending');
  const qc = useQueryClient();
  const [decide, setDecide] = useState<{ req: CorrectionRequest; approve: boolean } | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  if (!can('corrections.manage')) {
    return (
      <>
        <PageHeader title="Corrections" />
        <Card>
          <EmptyState
            icon={<ShieldAlert />}
            title="Client Admins only"
            description="Correction requests are reviewed by your Client Admin."
          />
        </Card>
      </>
    );
  }

  async function confirm() {
    if (!decide) return;
    setBusy(true);
    try {
      await logApi.decide(plant.id, decide.req.id, decide.approve, comment.trim());
      toast.success(decide.approve ? 'Correction approved' : 'Request rejected', {
        description: decide.approve
          ? 'The values were changed and the reports are being recalculated.'
          : 'The requester is notified.',
      });
      void qc.invalidateQueries({ queryKey: ['c', 'plant', plant.id, 'corrections'] });
      if (decide.approve) invalidatePlantData(qc, plant.id);
      setDecide(null);
      setComment('');
    } catch (e) {
      toast.error(errorMessage(e));
      void qc.invalidateQueries({ queryKey: qk.client.corrections(plant.id, 'pending') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Corrections"
        subtitle={`${plant.name} · changes your Editors asked for on submitted logsheets`}
        actions={
          <Button variant="secondary" asChild>
            <Link href={`/plants/${plant.id}/logsheet`}>
              <ClipboardList /> Logsheet calendar
            </Link>
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented<Status>
          value={status}
          onChange={setStatus}
          items={[
            { value: 'pending', label: 'Pending', count: pending.data?.length },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ]}
        />
        <p className="text-ink-500 text-xs">
          Approving applies the values with the Editor’s reason and recalculates the reports.
        </p>
      </div>
      {q.isLoading ? (
        <div className="space-y-6">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="rounded-card h-64" />
          ))}
        </div>
      ) : !q.data?.length ? (
        <Card>
          <EmptyState
            icon={status === 'pending' ? <Inbox /> : <FilePenLine />}
            title={status === 'pending' ? 'No pending requests' : `No ${status} requests`}
            description={
              status === 'pending'
                ? 'When an Editor asks to change a submitted logsheet, it appears here for you to approve or reject.'
                : 'Decided requests are kept here for the record.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          <AnimatePresence initial={false}>
            {q.data.map((r) => (
              <RequestCard
                key={r.id}
                req={r}
                plantId={plant.id}
                onDecide={(approve) =>
                  readOnly ? toast.error('The account is read-only.') : setDecide({ req: r, approve })
                }
              />
            ))}
          </AnimatePresence>
        </div>
      )}
      <Modal
        open={!!decide}
        onOpenChange={(o) => !busy && !o && setDecide(null)}
        tone={decide?.approve ? 'success' : 'danger'}
        icon={decide?.approve ? <Check /> : <X />}
        title={decide?.approve ? 'Approve this correction?' : 'Reject this request?'}
        description={
          decide?.approve
            ? `The ${decide.req.proposed.length} value(s) of ${fmtDate(decide.req.date)} are changed now; the history keeps the old values.`
            : 'Nothing changes on the logsheet. Tell the Editor why, if useful.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setDecide(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant={decide?.approve ? 'primary' : 'danger'} onClick={confirm} loading={busy}>
              {decide?.approve ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        <Field label="Comment" hint="Optional — sent to the Editor.">
          <Textarea rows={3} value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)} />
        </Field>
      </Modal>
    </>
  );
}
