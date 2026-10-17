import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import {
  savedReportsApi,
  type SavedReport,
  type ReportSchedule,
} from '../../lib/saved-reports-api';

interface SaveReportButtonProps {
  reportKey: string;
  route: string;
  params: Record<string, unknown>;
  defaultName?: string;
}

const SCHEDULE_LABELS: Record<ReportSchedule, string> = {
  none: 'No schedule',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

const fieldClass =
  'w-full mt-1 px-3 py-2 bg-slate-950 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/20';

export const SaveReportButton = ({
  reportKey,
  route,
  params,
  defaultName,
}: SaveReportButtonProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName ?? '');
  const [description, setDescription] = useState('');
  const [schedule, setSchedule] = useState<ReportSchedule>('none');
  const [recipients, setRecipients] = useState('');
  const [manageOpen, setManageOpen] = useState(false);
  const { showSuccess, showError } = useToast();
  const requestConfirmation = useConfirm();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleOpenSave = () => {
    if (!name) setName(defaultName ?? '');
    setOpen(true);
  };

  const { data: savedReports } = useQuery({
    queryKey: ['saved-reports', reportKey],
    queryFn: () => savedReportsApi.list(),
  });

  const matchingReports = (savedReports ?? []).filter((r) => r.reportKey === reportKey);

  const createMutation = useMutation({
    mutationFn: () =>
      savedReportsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        reportKey,
        route,
        params,
        schedule,
        recipients: recipients
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
      showSuccess('Report saved');
      setOpen(false);
      setName('');
      setDescription('');
      setSchedule('none');
      setRecipients('');
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to save report');
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => savedReportsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
      showSuccess('Removed');
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to remove report');
    },
  });

  const handleRemove = async (r: SavedReport) => {
    const confirmed = await requestConfirmation({
      title: 'Remove saved report?',
      message: `"${r.name}" will be removed permanently.`,
      confirmLabel: 'Remove',
      variant: 'danger',
    });
    if (confirmed) removeMutation.mutate(r._id);
  };

  const handleOpen = (r: SavedReport) => {
    setOpen(false);
    setManageOpen(false);
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(r.params)) {
      if (v !== undefined && v !== null && v !== '') {
        search.set(k, String(v));
      }
    }
    const qs = search.toString();
    navigate(qs ? `${r.route}?${qs}` : r.route);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleOpenSave}
          className="px-3 py-1.5 text-xs font-medium bg-slate-900 border border-white/10 text-slate-300 rounded-lg hover:border-emerald-500/50 hover:text-emerald-400 flex items-center gap-1.5"
          title="Save this report configuration"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
          </svg>
          Save
        </button>
        {matchingReports.length > 0 && (
          <button
            onClick={() => setManageOpen(true)}
            className="px-3 py-1.5 text-xs font-medium bg-slate-900 border border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/10"
            title="Load a saved report"
          >
            Saved ({matchingReports.length})
          </button>
        )}
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Save report" size="md">
        <p className="text-xs text-slate-400 mb-4">
          Save this configuration to reload later, or schedule email delivery.
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekly revenue report"
              className={fieldClass}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this report for?"
              className={fieldClass}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Schedule</label>
            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value as ReportSchedule)}
              className={fieldClass}
            >
              {(Object.keys(SCHEDULE_LABELS) as ReportSchedule[]).map((s) => (
                <option key={s} value={s}>
                  {SCHEDULE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          {schedule !== 'none' && (
            <div>
              <label className="text-xs text-slate-400">Recipients (comma-separated emails)</label>
              <input
                type="text"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                placeholder="alice@example.com, bob@example.com"
                className={fieldClass}
              />
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!name.trim()}
            isLoading={createMutation.isPending}
          >
            Save
          </Button>
        </div>
      </Modal>

      <Modal isOpen={manageOpen} onClose={() => setManageOpen(false)} title="Saved reports" size="md">
        <p className="text-xs text-slate-400 mb-4">Click to load, or remove with the x button</p>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {matchingReports.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">No saved reports yet</p>
          ) : (
            matchingReports.map((r) => (
              <div
                key={r._id}
                className="flex items-center justify-between gap-3 p-3 bg-slate-950 border border-white/10 rounded-lg hover:border-emerald-500/40 transition-colors"
              >
                <button onClick={() => handleOpen(r)} className="flex-1 text-left">
                  <p className="text-sm font-semibold text-white">{r.name}</p>
                  <p className="text-xs text-slate-400 truncate">
                    {SCHEDULE_LABELS[r.schedule]}
                    {r.description ? ` - ${r.description}` : ''}
                  </p>
                </button>
                <button
                  onClick={() => handleRemove(r)}
                  disabled={removeMutation.isPending && removeMutation.variables === r._id}
                  className="text-rose-400 hover:text-rose-300 text-sm disabled:opacity-50"
                  title="Remove"
                >
                  x
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={() => setManageOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </>
  );
};
