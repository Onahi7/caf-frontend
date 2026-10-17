import { useId, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { useCurrency } from '../../hooks/useCurrency';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { amount: number; category: string; description: string }) => void;
  isLoading?: boolean;
}

const expenseCategories = [
  { value: 'supplies', label: 'Store & Office Supplies' },
  { value: 'maintenance', label: 'Equipment & Maintenance' },
  { value: 'utilities', label: 'Utilities & Internet' },
  { value: 'petty_cash', label: 'Petty Cash Disbursement' },
  { value: 'rent', label: 'Rent & Facility' },
  { value: 'salaries', label: 'Wages & Staff Advance' },
  { value: 'other', label: 'Other Operational Expense' },
];

export const ExpenseModal = ({ isOpen, onClose, onSubmit, isLoading }: ExpenseModalProps) => {
  const { symbol } = useCurrency();
  const amountId = useId();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('supplies');
  const [description, setDescription] = useState('');

  const handleClose = () => {
    if (isLoading) return;
    setAmount('');
    setCategory('supplies');
    setDescription('');
    onClose();
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0 || !description.trim()) return;
    onSubmit({ amount: parsedAmount, category, description: description.trim() });
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Record Cash Expense" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-slate-400 leading-relaxed">
          Record a cash disbursement from this register drawer. The amount will be deducted from closing expected cash.
        </p>

        <div>
          <label htmlFor={amountId} className="block text-sm font-medium text-slate-200 mb-1.5">
            Expense Amount ({symbol})
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-sm select-none">
              {symbol}
            </span>
            <input
              id={amountId}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="w-full min-h-11 pl-9 pr-4 py-2.5 rounded-xl border border-white/10 bg-slate-950/60 text-white placeholder-slate-500 text-base sm:text-sm focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              autoFocus
            />
          </div>
        </div>

        <Select
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={expenseCategories}
        />

        <Textarea
          label="Purpose / Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Receipt paper rolls, cleaning supplies..."
          rows={3}
          required
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
            variant="primary"
            disabled={isLoading || !Number.isFinite(Number(amount)) || Number(amount) <= 0 || !description.trim()}
            isLoading={isLoading}
            className="flex-1"
          >
            Log Expense
          </Button>
        </div>
      </form>
    </Modal>
  );
};
