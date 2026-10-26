import { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { useCurrency } from '../../hooks/useCurrency';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, ShieldCheck, Calculator } from 'lucide-react';

const DENOMINATIONS = [100, 50, 20, 10, 5, 2, 1];

interface DenominationCounterProps {
  onTotalChange: (total: number) => void;
  symbol: string;
}

const DenominationCounter = ({ onTotalChange, symbol }: DenominationCounterProps) => {
  const [counts, setCounts] = useState<Record<number, string>>({
    100: '',
    50: '',
    20: '',
    10: '',
    5: '',
    2: '',
    1: '',
  });

  const handleCountChange = (denom: number, val: string) => {
    const updated = { ...counts, [denom]: val };
    setCounts(updated);
    let total = 0;
    for (const [d, countStr] of Object.entries(updated)) {
      const c = parseInt(countStr, 10);
      if (!isNaN(c) && c > 0) {
        total += Number(d) * c;
      }
    }
    onTotalChange(total);
  };

  const handleClear = () => {
    setCounts({ 100: '', 50: '', 20: '', 10: '', 5: '', 2: '', 1: '' });
    onTotalChange(0);
  };

  const currentTotal = useMemo(() => {
    let sum = 0;
    for (const [d, countStr] of Object.entries(counts)) {
      const c = parseInt(countStr, 10);
      if (!isNaN(c) && c > 0) {
        sum += Number(d) * c;
      }
    }
    return sum;
  }, [counts]);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 space-y-2.5 text-xs">
      <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
          <span>💵</span> Note Denomination Calculator
        </span>
        {currentTotal > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
          >
            Clear notes
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {DENOMINATIONS.map((denom) => {
          const count = counts[denom] || '';
          const subtotal = (parseInt(count, 10) || 0) * denom;
          return (
            <div key={denom} className="flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-xl border border-white/5">
              <span className="font-mono text-emerald-400 font-bold shrink-0 w-12 text-[11px]">
                {symbol}{denom}
              </span>
              <span className="text-slate-500 font-mono text-xs">×</span>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={count}
                onChange={(e) => handleCountChange(denom, e.target.value)}
                className="w-full min-w-0 bg-slate-950 px-2 py-1 rounded-lg text-white font-mono text-center text-xs border border-white/10 focus:border-emerald-500/50 focus:outline-none"
              />
              {subtotal > 0 && (
                <span className="hidden sm:inline font-mono text-[10px] text-slate-400 shrink-0">
                  ={subtotal}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center pt-1 border-t border-white/5 text-slate-300">
        <span>Calculated Total:</span>
        <span className="font-mono font-bold text-emerald-400 text-sm">
          {symbol} {currentTotal.toFixed(2)}
        </span>
      </div>
    </div>
  );
};

interface OpenShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (openingCash: number) => void;
  isLoading?: boolean;
}

export const OpenShiftModal = ({ isOpen, onClose, onSubmit, isLoading }: OpenShiftModalProps) => {
  const { symbol } = useCurrency();
  const [openingCash, setOpeningCash] = useState('');
  const [showDenominations, setShowDenominations] = useState(false);

  const handleClose = () => {
    setOpeningCash('');
    setShowDenominations(false);
    onClose();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const parsed = parseFloat(openingCash);
    if (isNaN(parsed) || parsed < 0) return;
    onSubmit(parsed);
    setOpeningCash('');
    setShowDenominations(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Open Register Shift" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-400">
          Enter the starting physical cash (float) counted in the drawer before starting transactions.
        </p>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Opening Float ({symbol})
            </label>
            <button
              type="button"
              onClick={() => setShowDenominations((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>{showDenominations ? 'Simple Input' : 'Count Notes'}</span>
            </button>
          </div>

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

        {/* Note Denomination Calculator */}
        {showDenominations && (
          <DenominationCounter
            symbol={symbol}
            onTotalChange={(total) => setOpeningCash(total > 0 ? total.toFixed(2) : '')}
          />
        )}

        <div className="flex gap-3 pt-2">
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
            disabled={isLoading || !openingCash.trim()}
            isLoading={isLoading}
            className="flex-1"
          >
            Open Register
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
  salesCount?: number;
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
  salesCount,
}: CloseShiftModalProps) => {
  const { symbol, format } = useCurrency();
  const [closingCash, setClosingCash] = useState('');
  const [notes, setNotes] = useState('');
  const [isBlindClose, setIsBlindClose] = useState(false);
  const [showDenominations, setShowDenominations] = useState(false);

  const handleClose = () => {
    setClosingCash('');
    setNotes('');
    setShowDenominations(false);
    onClose();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const parsed = parseFloat(closingCash);
    if (isNaN(parsed) || parsed < 0) return;
    onSubmit(parsed, notes.trim());
    setClosingCash('');
    setNotes('');
    setShowDenominations(false);
  };

  const parsedClosing = parseFloat(closingCash);
  const hasEnteredCash = !isNaN(parsedClosing);
  const computedExpectedCash =
    expectedCash !== undefined &&
    totalExpenses > 0 &&
    Math.abs(expectedCash - (openingCash + totalSales)) < 0.01
      ? Math.max(0, openingCash + totalSales - totalExpenses)
      : expectedCash !== undefined
      ? expectedCash
      : Math.max(0, openingCash + totalSales - totalExpenses);
  const discrepancy = hasEnteredCash ? parsedClosing - computedExpectedCash : 0;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Close Register Shift" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Blind Close Mode Toggle Bar */}
        <div className="flex items-center justify-between px-1 text-xs">
          <span className="text-slate-400 font-medium">Reconciliation Mode:</span>
          <button
            type="button"
            onClick={() => setIsBlindClose((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
          >
            {isBlindClose ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Reveal Expected Total</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Switch to Blind Close</span>
              </>
            )}
          </button>
        </div>

        {/* Shift Cash Reconciliation Summary */}
        <div className="rounded-2xl border border-white/[0.08] bg-slate-950/50 p-4 space-y-2.5">
          {isBlindClose ? (
            <div className="py-3 text-center space-y-1">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-1">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-slate-200">Blind Reconciliation Active</p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Count your physical drawer independently to prevent bias.
              </p>
            </div>
          ) : (
            <>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Opening Cash</span>
                <span className="font-mono text-slate-200">{format(openingCash)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>Cash Sales Total</span>
                <span className="font-mono text-slate-200">{format(totalSales)}</span>
              </div>
              {salesCount !== undefined && (
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Transactions</span>
                  <span className="font-mono text-slate-200">{salesCount}</span>
                </div>
              )}
              {totalExpenses > 0 && (
                <div className="flex justify-between text-xs text-rose-400">
                  <span>Expenses Disbursed</span>
                  <span className="font-mono">- {format(totalExpenses)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold pt-2 border-t border-white/[0.08]">
                <span className="text-white">Expected in Drawer</span>
                <span className="font-mono text-emerald-400 font-bold">{format(computedExpectedCash)}</span>
              </div>
            </>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Actual Cash Counted ({symbol})
            </label>
            <button
              type="button"
              onClick={() => setShowDenominations((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>{showDenominations ? 'Simple Input' : 'Count Notes'}</span>
            </button>
          </div>

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

        {/* Note Denomination Calculator */}
        {showDenominations && (
          <DenominationCounter
            symbol={symbol}
            onTotalChange={(total) => setClosingCash(total > 0 ? total.toFixed(2) : '')}
          />
        )}

        {/* Discrepancy indicator */}
        {!isBlindClose && hasEnteredCash && (
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
                <span>Cash perfectly balanced with register drawer.</span>
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
