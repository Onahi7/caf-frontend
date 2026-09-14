import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { useCurrency } from '../../hooks/useCurrency';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (openingCash: number) => void;
  isLoading?: boolean;
}

export const OpenShiftModal = ({ isOpen, onClose, onSubmit, isLoading }: OpenShiftModalProps) => {
  const { symbol } = useCurrency();
  const [openingCash, setOpeningCash] = useState('');

  const handleClose = () => {
    setOpeningCash('');
    onClose();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const parsed = parseFloat(openingCash);
    if (isNaN(parsed) || parsed < 0) return;
    onSubmit(parsed);
    setOpeningCash('');
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Open Register Shift" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-400 leading-relaxed">
          Count the starting cash in your physical register drawer before accepting transactions.
        </p>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Opening Cash Float ({symbol})
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-sm select-none">
              {symbol}
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="0.00"
              required
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-white/10 bg-slate-950/60 text-white placeholder-slate-500 text-sm focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              autoFocus
            />
          </div>
        </div>

        <div className="flex gap-3 pt-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            className="flex-1"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading || !openingCash.trim()}
            isLoading={isLoading}
            className="flex-1"
          >
            Open Shift
          </Button>
        </div>
      </form>
    </Modal>
  );
};

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (closingCash: number, notes: string) => void;
  isLoading?: boolean;
  openingCash: number;
  totalSales: number;
  totalExpenses: number;
  expectedCash: number;
}

export const CloseShiftModal = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  openingCash,
  totalSales,
  totalExpenses,
  expectedCash,
}: CloseShiftModalProps) => {
  const { symbol, format } = useCurrency();
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');

  const handleClose = () => {
    setClosingCash('');
    setNotes('');
    onClose();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const parsed = parseFloat(closingCash);
    if (isNaN(parsed) || parsed < 0) return;
    onSubmit(parsed, notes.trim());
    setClosingCash('');
    setNotes('');
  };

  const parsedClosing = parseFloat(closingCash);
  const hasEnteredCash = !isNaN(parsedClosing);
  const discrepancy = hasEnteredCash ? parsedClosing - expectedCash : 0;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Close Register Shift" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Shift Cash Reconciliation Summary */}
        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/50 p-4 space-y-2.5">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Opening Cash</span>
            <span className="font-mono text-slate-200">{format(openingCash)}</span>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Cash Sales Total</span>
            <span className="font-mono text-slate-200">{format(totalSales)}</span>
          </div>
          {totalExpenses > 0 && (
            <div className="flex justify-between text-xs text-rose-400">
              <span>Expenses Disbursed</span>
              <span className="font-mono">- {format(totalExpenses)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-semibold pt-2 border-t border-white/[0.08]">
            <span className="text-white">Expected in Drawer</span>
            <span className="font-mono text-emerald-400 font-bold">{format(expectedCash)}</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Actual Cash Counted ({symbol})
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-sm select-none">
              {symbol}
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              placeholder="0.00"
              required
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-white/10 bg-slate-950/60 text-white placeholder-slate-500 text-sm focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              autoFocus
            />
          </div>
        </div>

        {/* Discrepancy indicator */}
        {hasEnteredCash && (
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border ${
              Math.abs(discrepancy) < 0.01
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                : discrepancy > 0
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
            }`}
          >
            {Math.abs(discrepancy) < 0.01 ? (
              <>
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Cash perfectly balanced with register.</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {discrepancy > 0 ? 'Surplus:' : 'Shortage:'}{' '}
                  <strong>{format(Math.abs(discrepancy))}</strong>
                </span>
              </>
            )}
          </div>
        )}

        <Textarea
          label="Handover / Discrepancy Notes (Optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Note any reasons for discrepancy or shift comments..."
          rows={2}
        />

        <div className="flex gap-3 pt-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            className="flex-1"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={isLoading || !closingCash.trim()}
            isLoading={isLoading}
            className="flex-1"
          >
            Close & Reconcile
          </Button>
        </div>
      </form>
    </Modal>
  );
};
