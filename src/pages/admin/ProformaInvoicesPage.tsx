import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useToast } from '../../hooks/useToast';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { getErrorMessage } from '../../lib/error-utils';
import { formatDate } from '../../lib/date-format';
import { useCurrency } from '../../hooks/useCurrency';
import { FileText, CheckCircle, XCircle, DollarSign, ShoppingCart, Download } from 'lucide-react';

interface ProformaInvoice {
  _id: string;
  proformaNumber: string;
  customerId: { _id: string; firstName: string; lastName: string; phone?: string } | string;
  items: { productName: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: string;
  paymentStatus: string;
  payments: { amount: number; method: string; paidAt: string }[];
  saleId?: string;
  validUntil: string;
  notes?: string;
  createdAt: string;
}

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    draft: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    pending_approval: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    converted: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };
  return styles[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';
};

const paymentBadge = (status: string) => {
  const styles: Record<string, string> = {
    unpaid: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    partial: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  };
  return styles[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';
};

export function ProformaInvoicesPage() {
  const { symbol } = useCurrency();
  const navigate = useNavigate();
  const [selectedPf, setSelectedPf] = useState<ProformaInvoice | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const { selectedBranch } = useBranchStore();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const branchId = getBranchId(selectedBranch);

  const { register: registerPayment, handleSubmit: handleSubmitPayment, reset: resetPayment } = useForm();
  const { register: registerConvert, handleSubmit: handleSubmitConvert, reset: resetConvert } = useForm();

  const { data: proformas, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.proformas.list({ branchId }),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/proforma-invoices', { branchId }));
      const payload = response.data?.data ?? response.data;
      return (Array.isArray(payload) ? payload : []) as ProformaInvoice[];
    },
    enabled: !!branchId,
  });

  const submitMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/proforma-invoices/${id}/submit`),
    onSuccess: () => {
      showSuccess('Submitted for approval');
      setSelectedPf((prev) => (prev ? { ...prev, status: 'pending_approval' } : null));
      queryClient.invalidateQueries({ queryKey: queryKeys.proformas.all() });
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to submit proforma')),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/proforma-invoices/${id}/approve`),
    onSuccess: () => {
      showSuccess('Proforma approved');
      setSelectedPf((prev) => (prev ? { ...prev, status: 'approved' } : null));
      queryClient.invalidateQueries({ queryKey: queryKeys.proformas.all() });
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to approve proforma')),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => apiClient.patch(`/proforma-invoices/${id}/reject`, { reason }),
    onSuccess: () => {
      showSuccess('Proforma rejected');
      setIsRejectModalOpen(false);
      setSelectedPf(null);
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: queryKeys.proformas.all() });
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to reject proforma')),
  });

  const handlePaymentSubmit = async (data: any) => {
    if (!selectedPf) return;
    try {
      await apiClient.post(`/proforma-invoices/${selectedPf._id}/payments`, {
        amount: parseFloat(data.amount),
        method: data.method,
        reference: data.reference,
      });
      showSuccess('Payment recorded');
      setIsPaymentModalOpen(false);
      setSelectedPf(null);
      resetPayment();
      queryClient.invalidateQueries({ queryKey: queryKeys.proformas.all() });
    } catch (err: unknown) {
      showError(getErrorMessage(err, 'Payment failed'));
    }
  };

  const handleConvertSubmit = async (data: any) => {
    if (!selectedPf) return;
    try {
      await apiClient.post(`/proforma-invoices/${selectedPf._id}/convert`, {
        paymentMethod: data.paymentMethod,
        amountPaid: data.amountPaid ? parseFloat(data.amountPaid) : undefined,
      });
      showSuccess('Converted to sale successfully');
      setIsConvertModalOpen(false);
      setSelectedPf(null);
      resetConvert();
      queryClient.invalidateQueries({ queryKey: queryKeys.proformas.all() });
    } catch (err: unknown) {
      showError(getErrorMessage(err, 'Conversion failed'));
    }
  };

  const handleDownloadPdf = async (id: string) => {
    try {
      const response = await apiClient.get(`/proforma-invoices/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `proforma-${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      showError(getErrorMessage(err, 'Failed to download PDF'));
    }
  };

  const getCustomerName = (pf: ProformaInvoice) => {
    if (typeof pf.customerId === 'object' && pf.customerId) {
      return `${pf.customerId.firstName} ${pf.customerId.lastName}`;
    }
    return 'Customer';
  };

  const columns = [
    { key: 'proformaNumber', header: 'Proforma #' },
    {
      key: 'customerId', header: 'Customer',
      render: (pf: ProformaInvoice) => getCustomerName(pf),
    },
    {
      key: 'total', header: 'Total',
      render: (pf: ProformaInvoice) => `${symbol}${pf.total.toFixed(2)}`,
    },
    {
      key: 'status', header: 'Status',
      render: (pf: ProformaInvoice) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusBadge(pf.status)}`}>
          {pf.status.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'paymentStatus', header: 'Payment',
      render: (pf: ProformaInvoice) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${paymentBadge(pf.paymentStatus)}`}>
          {pf.paymentStatus}
        </span>
      ),
    },
    {
      key: 'createdAt', header: 'Date',
      render: (pf: ProformaInvoice) => formatDate(pf.createdAt),
    },
  ];

  return (
    <AdminLayout title="Proforma Invoices">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-slate-400">Create and manage proforma invoices generated from customer order requests</p>
        <Button onClick={() => navigate('/admin/customer-orders')}>
          <FileText className="w-4 h-4 mr-2" />
          Upload Customer Order
        </Button>
      </div>

      {isLoading ? (
        <Loading variant="centered" text="Loading proformas..." />
      ) : error ? (
        <Error message="Failed to load proforma invoices" onRetry={refetch} />
      ) : (
        <Table
          data={proformas || []}
          columns={columns}
          emptyMessage="No proforma invoices yet."
          onRowClick={(item) => setSelectedPf(item)}
        />
      )}

      <Modal isOpen={!!selectedPf && !isPaymentModalOpen && !isConvertModalOpen && !isRejectModalOpen}
             onClose={() => setSelectedPf(null)} title={selectedPf?.proformaNumber || 'Proforma Detail'} size="lg">
        {selectedPf && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Customer: {getCustomerName(selectedPf)}</p>
                <p className="text-sm text-slate-400">Date: {formatDate(selectedPf.createdAt)}</p>
                <p className="text-sm text-slate-400">Valid until: {formatDate(selectedPf.validUntil)}</p>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusBadge(selectedPf.status)}`}>
                  {selectedPf.status.replace('_', ' ')}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${paymentBadge(selectedPf.paymentStatus)}`}>
                  {selectedPf.paymentStatus}
                </span>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-white mb-3">Items</h4>
              <div className="space-y-2">
                {selectedPf.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 bg-white/5 rounded-xl p-3">
                    <p className="text-white font-medium whitespace-normal break-words min-w-0 flex-1">{item.productName}</p>
                    <p className="shrink-0 text-slate-400">{item.quantity} x {symbol}{item.unitPrice.toFixed(2)} = {symbol}{item.total.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 space-y-1 text-right">
              <p className="text-slate-400">Subtotal: {symbol}{selectedPf.subtotal.toFixed(2)}</p>
              {selectedPf.taxRate > 0 && (
                <p className="text-slate-400">VAT ({(selectedPf.taxRate * 100).toFixed(0)}%): {symbol}{selectedPf.taxAmount.toFixed(2)}</p>
              )}
              <p className="text-xl font-bold text-white">Total: {symbol}{selectedPf.total.toFixed(2)}</p>
            </div>

            {selectedPf.payments?.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold text-white mb-3">Payments</h4>
                <div className="space-y-2">
                  {selectedPf.payments.map((p, i) => (
                    <div key={i} className="flex justify-between bg-white/5 rounded-xl p-3">
                      <p className="text-slate-400">{p.method} - {formatDate(p.paidAt)}</p>
                      <p className="text-white font-medium">{symbol}{p.amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedPf.notes && <p className="text-slate-400 text-sm">Notes: {selectedPf.notes}</p>}

            <div className="flex flex-wrap gap-3">
              {selectedPf.status === 'draft' && selectedPf._id && (
                <Button
                  onClick={() => submitMutation.mutate(selectedPf._id)}
                  isLoading={submitMutation.isPending}
                  disabled={approveMutation.isPending}
                >
                  Submit for Approval
                </Button>
              )}
              {selectedPf.status === 'pending_approval' && selectedPf._id && (
                <>
                  <Button
                    onClick={() => approveMutation.mutate(selectedPf._id)}
                    variant="primary"
                    isLoading={approveMutation.isPending}
                    disabled={submitMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />Approve
                  </Button>
                  <Button onClick={() => setIsRejectModalOpen(true)} variant="danger">
                    <XCircle className="w-4 h-4 mr-2" />Reject
                  </Button>
                </>
              )}
              {(selectedPf.status === 'approved' || selectedPf.status === 'converted') && selectedPf.paymentStatus !== 'paid' && (
                <Button onClick={() => { setIsPaymentModalOpen(true); }} variant="secondary">
                  <DollarSign className="w-4 h-4 mr-2" />Record Payment
                </Button>
              )}
              {selectedPf.status === 'approved' && (
                <Button onClick={() => { setIsConvertModalOpen(true); }}>
                  <ShoppingCart className="w-4 h-4 mr-2" />Convert to Sale
                </Button>
              )}
              <Button onClick={() => handleDownloadPdf(selectedPf._id)} variant="ghost">
                <Download className="w-4 h-4 mr-2" />Download PDF
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Proforma"
      >
        <div className="space-y-4">
          <Input
            label="Reason"
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            placeholder="Explain why this proforma is being rejected"
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={rejectMutation.isPending}
              disabled={!selectedPf || !rejectionReason.trim()}
              onClick={() => selectedPf && rejectMutation.mutate({
                id: selectedPf._id,
                reason: rejectionReason.trim(),
              })}
            >
              Reject Proforma
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Record Payment">
        <form onSubmit={handleSubmitPayment(handlePaymentSubmit)} className="space-y-4">
          <Input label="Amount" type="number" step="0.01" required {...registerPayment('amount', { required: true })} />
          <Select label="Payment Method" required {...registerPayment('method', { required: true })}>
            <option value="">Select method</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="credit">Credit</option>
          </Select>
          <Input label="Reference (optional)" {...registerPayment('reference')} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsPaymentModalOpen(false)}>Cancel</Button>
            <Button type="submit">Record Payment</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isConvertModalOpen} onClose={() => setIsConvertModalOpen(false)} title="Convert to Sale">
        <form onSubmit={handleSubmitConvert(handleConvertSubmit)} className="space-y-4">
          <Select label="Payment Method" required {...registerConvert('paymentMethod', { required: true })}>
            <option value="">Select method</option>
            <option value="cash">Cash</option>
            <option value="credit">Credit</option>
          </Select>
          <Input label="Amount Paid" type="number" step="0.01" {...registerConvert('amountPaid')} />
          <p className="text-sm text-slate-400">The proforma items will be converted to a sale and stock will be deducted.</p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsConvertModalOpen(false)}>Cancel</Button>
            <Button type="submit">Convert</Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
}
