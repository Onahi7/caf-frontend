import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FinanceLayout } from '../../components/FinanceLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useToast } from '../../hooks/useToast';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import apiClient from '../../lib/api-client';
import { buildApiUrl } from '../../lib/api-utils';
import { getErrorMessage } from '../../lib/error-utils';
import { Plus, DollarSign, Trash2, Undo2 } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';

interface Advance {
  _id: string;
  referenceNumber: string;
  employeeId: { _id: string; firstName: string; lastName: string; username: string };
  type: 'goods' | 'cash';
  totalAmount: number;
  outstandingAmount: number;
  totalCost: number;
  status: 'outstanding' | 'partially_settled' | 'fully_settled' | 'written_off';
  advanceDate: string;
  items: { productId: string; productName?: string; quantity: number; unitPrice: number; subtotal: number }[];
  repayments: { amount: number; type: string; repaymentDate: string }[];
  notes?: string;
}

interface AdvanceStats {
  totalActive: number;
  totalOutstanding: number;
  totalCashAdvances: number;
  totalGoodsAdvances: number;
  totalCostToCompany: number;
}

interface Product { _id: string; name: string; sku: string; sellingPrice: number; quantityAvailable?: number }
interface Employee { _id: string; firstName: string; lastName: string; username: string }

const statusBadge = (status: string) => {
  const s: Record<string, string> = {
    outstanding: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    partially_settled: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    fully_settled: 'bg-green-500/10 text-green-400 border-green-500/20',
    written_off: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return s[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
};

interface CartItem { productId: string; productName: string; quantity: number; unitPrice: number }

export function FinanceAdvancesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [repayModal, setRepayModal] = useState<Advance | null>(null);
  const [writeOffModal, setWriteOffModal] = useState<Advance | null>(null);
  const [returnModal, setReturnModal] = useState<Advance | null>(null);
  const [returnItems, setReturnItems] = useState<{ productId: string; productName: string; maxQuantity: number; returnQuantity: number; unitPrice: number }[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [writeOffReason, setWriteOffReason] = useState('');
  const [form, setForm] = useState({
    referenceNumber: `ADV-${Date.now().toString().slice(-6)}`,
    employeeId: '',
    type: 'goods' as 'goods' | 'cash',
    advanceDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const { selectedBranch } = useBranchStore();
  const user = useAuthStore((state) => state.user);
  const branchId = getBranchId(selectedBranch);
  const effectiveBranchId = user?.role === 'super_admin' ? undefined : branchId;
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { format } = useCurrency();

  const { data: advances, isLoading, error, refetch } = useQuery({
    queryKey: ['finance', 'advances', effectiveBranchId],
    queryFn: async () => {
      const res = await apiClient.get(buildApiUrl('/finance-manager/advances', { branchId: effectiveBranchId }));
      return (res.data?.data ?? res.data) as Advance[];
    },
    enabled: user?.role === 'super_admin' || !!effectiveBranchId,
  });

  const { data: stats } = useQuery({
    queryKey: ['finance', 'advances-stats', effectiveBranchId],
    queryFn: async () => {
      const res = await apiClient.get(buildApiUrl('/finance-manager/advances/stats/summary', { branchId: effectiveBranchId }));
      return (res.data?.data ?? res.data) as AdvanceStats;
    },
    enabled: user?.role === 'super_admin' || !!effectiveBranchId,
  });

  const { data: employees } = useQuery({
    queryKey: ['finance', 'employees', branchId],
    queryFn: async () => {
      const res = await apiClient.get(buildApiUrl('/users', { branchId, limit: 200 }));
      return (res.data?.data ?? res.data?.data?.data ?? []) as Employee[];
    },
    enabled: !!branchId && isCreateOpen,
  });

  const { data: products } = useQuery({
    queryKey: ['finance', 'product-search', productSearch, branchId],
    queryFn: async () => {
      const res = await apiClient.get(buildApiUrl('/products', { search: productSearch, branchId, limit: 50 }));
      return (res.data?.data?.data ?? res.data?.data ?? []) as Product[];
    },
    enabled: !!productSearch && form.type === 'goods' && isCreateOpen,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        ...form,
        branchId,
        totalAmount: form.type === 'goods' ? cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0) : 0,
        items: form.type === 'goods' ? cart.map((c) => ({
          productId: c.productId,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
        })) : undefined,
      };
      if (form.type === 'cash') {
        payload.totalAmount = Number(form.notes?.match(/amount:(\d+)/)?.[1] || 0);
      }
      await apiClient.post('/finance-manager/advances', payload);
    },
    onSuccess: () => {
      showSuccess('Advance issued');
      queryClient.invalidateQueries({ queryKey: ['finance', 'advances'] });
      setIsCreateOpen(false);
      setCart([]);
      setForm({ ...form, employeeId: '', notes: '' });
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to create advance')),
  });

  const repayMutation = useMutation({
    mutationFn: async () => {
      if (!repayModal) return;
      await apiClient.patch(`/finance-manager/advances/${repayModal._id}/repay`, {
        amount: Number(repayAmount),
        type: 'cash_repayment',
        repaymentDate: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      showSuccess('Repayment recorded');
      queryClient.invalidateQueries({ queryKey: ['finance', 'advances'] });
      setRepayModal(null);
      setRepayAmount('');
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to record repayment')),
  });

  const writeOffMutation = useMutation({
    mutationFn: async () => {
      if (!writeOffModal) return;
      await apiClient.patch(`/finance-manager/advances/${writeOffModal._id}/write-off`, { reason: writeOffReason });
    },
    onSuccess: () => {
      showSuccess('Advance written off');
      queryClient.invalidateQueries({ queryKey: ['finance', 'advances'] });
      setWriteOffModal(null);
      setWriteOffReason('');
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to write off')),
  });

  const openReturnModal = (a: Advance) => {
    setReturnModal(a);
    setReturnItems((a.items || []).map((it) => ({
      productId: it.productId,
      productName: it.productName || it.productId,
      maxQuantity: it.quantity,
      returnQuantity: 0,
      unitPrice: it.unitPrice,
    })));
    setReturnReason('');
  };

  const returnMutation = useMutation({
    mutationFn: async () => {
      if (!returnModal) return;
      const items = returnItems
        .filter((it) => it.returnQuantity > 0)
        .map((it) => ({ productId: it.productId, quantity: it.returnQuantity }));
      if (items.length === 0) throw new globalThis.Error('Select at least one item to return');
      await apiClient.patch(`/finance-manager/advances/${returnModal._id}/goods-return`, {
        items,
        reason: returnReason || undefined,
      });
    },
    onSuccess: () => {
      showSuccess('Goods return recorded - stock restored');
      queryClient.invalidateQueries({ queryKey: ['finance', 'advances'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'advances-stats'] });
      setReturnModal(null);
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to record goods return')),
  });

  const addToCart = (p: Product) => {
    if (cart.find((c) => c.productId === p._id)) return;
    setCart([...cart, { productId: p._id, productName: p.name, quantity: 1, unitPrice: p.sellingPrice }]);
    setProductSearch('');
  };

  const updateCartItem = (productId: string, field: 'quantity' | 'unitPrice', value: number) => {
    setCart(cart.map((c) => c.productId === productId ? { ...c, [field]: value } : c));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter((c) => c.productId !== productId));
  };

  const cartTotal = cart.reduce((s, c) => s + c.quantity * c.unitPrice, 0);

  const columns = [
    { key: 'referenceNumber', header: 'Ref', render: (a: Advance) => <span className="font-mono text-white">{a.referenceNumber}</span> },
    { key: 'employee', header: 'Employee', render: (a: Advance) => a.employeeId ? `${a.employeeId.firstName} ${a.employeeId.lastName}` : '-' },
    { key: 'type', header: 'Type', render: (a: Advance) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
        a.type === 'goods' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'
      }`}>{a.type}</span>
    )},
    { key: 'totalAmount', header: 'Total', render: (a: Advance) => format(a.totalAmount) },
    { key: 'outstandingAmount', header: 'Outstanding', render: (a: Advance) => (
      <span className="font-semibold text-amber-400">{format(a.outstandingAmount)}</span>
    )},
    { key: 'status', header: 'Status', render: (a: Advance) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusBadge(a.status)}`}>{a.status.replace('_', ' ')}</span>
    )},
    { key: 'actions', header: '', render: (a: Advance) => (a.status === 'outstanding' || a.status === 'partially_settled') ? (
      <div className="flex gap-2">
        <Button size="sm" onClick={() => { setRepayModal(a); setRepayAmount(String(a.outstandingAmount)); }}>
          <DollarSign className="w-3 h-3 mr-1" />Repay
        </Button>
        {a.type === 'goods' && a.items && a.items.length > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => openReturnModal(a)}>
            <Undo2 className="w-3 h-3 mr-1" />Return
          </Button>
        ) : null}
        {(user?.role === 'super_admin' || user?.role === 'branch_manager') ? (
          <Button size="sm" variant="danger" onClick={() => setWriteOffModal(a)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        ) : null}
      </div>
    ) : null },
  ];

  return (
    <FinanceLayout title="Staff Advances">
      {stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-xs text-amber-300">Active</p>
            <p className="text-2xl font-bold text-white">{stats.totalActive}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-primary-dark/70 p-4">
            <p className="text-xs text-gray-400">Total Outstanding</p>
            <p
              className="text-lg sm:text-2xl font-bold text-white tabular-nums break-words leading-tight"
              title={format(stats.totalOutstanding)}
            >
              {format(stats.totalOutstanding)}
            </p>
          </div>
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
            <p className="text-xs text-blue-300">Goods Advances</p>
            <p
              className="text-lg sm:text-2xl font-bold text-white tabular-nums break-words leading-tight"
              title={format(stats.totalGoodsAdvances)}
            >
              {format(stats.totalGoodsAdvances)}
            </p>
          </div>
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
            <p className="text-xs text-green-300">Cost to Company</p>
            <p
              className="text-lg sm:text-2xl font-bold text-white tabular-nums break-words leading-tight"
              title={format(stats.totalCostToCompany)}
            >
              {format(stats.totalCostToCompany)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex justify-end">
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />Issue Advance
        </Button>
      </div>

      {isLoading ? <Loading variant="centered" /> : error ? <Error message="Failed to load" onRetry={refetch} /> : (
        <Table data={advances || []} columns={columns} emptyMessage="No staff advances" />
      )}

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Issue Staff Advance" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">Reference #</label>
              <input value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Date</label>
              <input type="date" value={form.advanceDate} onChange={(e) => setForm({ ...form, advanceDate: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'goods' | 'cash' })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10">
                <option value="goods">Goods</option>
                <option value="cash">Cash</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-1">Employee</label>
            <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10">
              <option value="">Select employee</option>
              {(employees || []).map((emp) => (
                <option key={emp._id} value={emp._id}>{emp.firstName} {emp.lastName} ({emp.username})</option>
              ))}
            </select>
          </div>

          {form.type === 'goods' ? (
            <div>
              <label className="block text-sm font-medium text-white mb-1">Add Products</label>
              <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search products..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
              {productSearch && (products?.length ?? 0) > 0 ? (
                <div className="mt-2 max-h-40 overflow-y-auto bg-primary-darker border border-white/10 rounded-lg">
                  {(products || []).map((p) => (
                    <button key={p._id} type="button" onClick={() => addToCart(p)}
                      className="w-full text-left px-3 py-2 hover:bg-white/5 border-b border-white/5 last:border-0">
                      <p className="text-white text-sm">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.sku} - {format(p.sellingPrice)}</p>
                    </button>
                  ))}
                </div>
              ) : null}
              {cart.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {cart.map((c) => (
                    <div key={c.productId} className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                      <span className="flex-1 text-white text-sm whitespace-normal break-words min-w-0">{c.productName}</span>
                      <input type="number" min="0.01" step="0.01" value={c.quantity} onChange={(e) => updateCartItem(c.productId, 'quantity', Number(e.target.value))}
                        className="w-20 px-2 py-1 rounded bg-primary-darker border border-white/10 text-white text-sm" />
                      <input type="number" min="0" step="0.01" value={c.unitPrice} onChange={(e) => updateCartItem(c.productId, 'unitPrice', Number(e.target.value))}
                        className="w-28 px-2 py-1 rounded bg-primary-darker border border-white/10 text-white text-sm" />
                      <span className="w-28 text-right text-white font-semibold text-sm">{format(c.quantity * c.unitPrice)}</span>
                      <button type="button" onClick={() => removeFromCart(c.productId)} className="text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-white/10">
                    <span className="text-gray-400 text-sm">Total</span>
                    <span className="text-white font-bold">{format(cartTotal)}</span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-white mb-1">Amount</label>
              <input type="number" value={form.notes?.match(/amount:(\d+)/)?.[1] || ''}
                onChange={(e) => setForm({ ...form, notes: `amount:${e.target.value}` })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white mb-1">Notes</label>
            <textarea value={form.notes?.startsWith('amount:') ? '' : form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} isLoading={createMutation.isPending} disabled={!form.employeeId || (form.type === 'goods' && cart.length === 0)}>
              Issue Advance
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!repayModal} onClose={() => setRepayModal(null)} title="Record Cash Repayment">
        {repayModal ? (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-white font-medium">{repayModal.referenceNumber} - {repayModal.employeeId?.firstName} {repayModal.employeeId?.lastName}</p>
              <p className="text-sm text-gray-400">Outstanding: {format(repayModal.outstandingAmount)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Amount</label>
              <input type="number" value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setRepayModal(null)}>Cancel</Button>
              <Button onClick={() => repayMutation.mutate()} isLoading={repayMutation.isPending}>Record</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal isOpen={!!writeOffModal} onClose={() => setWriteOffModal(null)} title="Write Off Advance">
        {writeOffModal ? (
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-white font-medium">Write off {format(writeOffModal.outstandingAmount)}?</p>
              <p className="text-sm text-gray-400">This will create a bad-debt expense entry. This cannot be undone.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Reason</label>
              <textarea value={writeOffReason} onChange={(e) => setWriteOffReason(e.target.value)} rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" placeholder="Why is this being written off?" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setWriteOffModal(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => writeOffMutation.mutate()} isLoading={writeOffMutation.isPending} disabled={!writeOffReason.trim()}>
                Write Off
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal isOpen={!!returnModal} onClose={() => setReturnModal(null)} title="Return Goods" size="lg">
        {returnModal ? (
          <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-sm text-amber-200">
              <Undo2 className="inline h-4 w-4 mr-2" />
              Returning items will restore inventory and reduce the advance outstanding amount.
            </div>
            <div className="bg-white/5 rounded-xl p-3 text-sm text-gray-300">
              <span className="text-white font-medium">{returnModal.referenceNumber}</span> - {returnModal.employeeId?.firstName} {returnModal.employeeId?.lastName}
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {returnItems.map((it, idx) => (
                <div key={it.productId} className="flex items-center gap-2 bg-white/5 rounded-lg p-2">
                  <span className="flex-1 text-white text-sm">{it.productName}</span>
                  <span className="text-xs text-gray-400">max {it.maxQuantity}</span>
                  <input type="number" min="0" max={it.maxQuantity} step="1" value={it.returnQuantity}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(it.maxQuantity, Number(e.target.value) || 0));
                      setReturnItems(returnItems.map((x, i) => i === idx ? { ...x, returnQuantity: v } : x));
                    }}
                    className="w-20 px-2 py-1 rounded bg-primary-darker border border-white/10 text-white text-sm" />
                  <span className="w-28 text-right text-white text-sm">{format(it.returnQuantity * it.unitPrice)}</span>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Reason (optional)</label>
              <textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} rows={2}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <span className="text-gray-400 text-sm">Return value</span>
              <span className="text-white font-bold">{format(returnItems.reduce((s, it) => s + it.returnQuantity * it.unitPrice, 0))}</span>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setReturnModal(null)}>Cancel</Button>
              <Button onClick={() => returnMutation.mutate()} isLoading={returnMutation.isPending}
                disabled={!returnItems.some((it) => it.returnQuantity > 0)}>
                <Undo2 className="w-4 h-4 mr-2" />Record Return
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </FinanceLayout>
  );
}
