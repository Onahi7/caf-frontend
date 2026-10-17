import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { AdminStatusBadge } from '../../components/admin';
import { useToast } from '../../hooks/useToast';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { getErrorMessage } from '../../lib/error-utils';
import { formatDate } from '../../lib/date-format';
import { formatStatusLabel, toneForStatus } from '../../lib/admin-tones';
import { CheckCircle, Download } from 'lucide-react';

interface DeliveryNoteItem {
  productId: string;
  productName: string;
  quantity: number;
}

interface DeliveryNote {
  _id: string;
  deliveryNumber: string;
  proformaInvoiceId: string;
  customerId: { _id: string; firstName: string; lastName: string; phone?: string } | string;
  items: DeliveryNoteItem[];
  status: string;
  deliveredAt?: string;
  deliveredBy?: string;
  notes?: string;
  createdAt: string;
}

export function DeliveryNotesPage() {
  const [selectedDn, setSelectedDn] = useState<DeliveryNote | null>(null);
  const { selectedBranch } = useBranchStore();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const branchId = getBranchId(selectedBranch);

  const { data: notes, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.deliveryNotes.list({ branchId }),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/delivery-notes', { branchId }));
      const payload = response.data?.data ?? response.data;
      return (Array.isArray(payload) ? payload : []) as DeliveryNote[];
    },
    enabled: !!branchId,
  });

  const markDeliveredMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/delivery-notes/${id}/deliver`),
    onSuccess: () => {
      showSuccess('Marked as delivered');
      setSelectedDn((prev) =>
        prev ? { ...prev, status: 'delivered', deliveredAt: new Date().toISOString() } : null,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.deliveryNotes.all() });
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to mark delivered')),
  });

  const handleDownloadPdf = async (id: string) => {
    try {
      const response = await apiClient.get(`/delivery-notes/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `delivery-note-${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      showError(getErrorMessage(err, 'Failed to download PDF'));
    }
  };

  const getCustomerName = (dn: DeliveryNote) => {
    if (typeof dn.customerId === 'object' && dn.customerId) {
      return `${dn.customerId.firstName} ${dn.customerId.lastName}`;
    }
    return 'Customer';
  };

  const columns = [
    { key: 'deliveryNumber', header: 'Delivery #' },
    {
      key: 'customerId', header: 'Customer',
      render: (dn: DeliveryNote) => getCustomerName(dn),
    },
    {
      key: 'items', header: 'Items',
      render: (dn: DeliveryNote) => `${dn.items.length} items`,
    },
    {
      key: 'status', header: 'Status',
      render: (dn: DeliveryNote) => (
        <AdminStatusBadge tone={toneForStatus(dn.status)}>
          {formatStatusLabel(dn.status)}
        </AdminStatusBadge>
      ),
    },
    {
      key: 'createdAt', header: 'Date',
      render: (dn: DeliveryNote) => formatDate(dn.createdAt),
    },
  ];

  return (
    <AdminLayout title="Delivery Notes">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-slate-400">Track deliveries for proforma invoices</p>
      </div>

      {isLoading ? (
        <Loading variant="centered" text="Loading delivery notes..." />
      ) : error ? (
        <Error message="Failed to load delivery notes" onRetry={refetch} />
      ) : (
        <Table
          data={notes || []}
          columns={columns}
          emptyMessage="No delivery notes yet."
          onRowClick={(item) => setSelectedDn(item)}
        />
      )}

      <Modal isOpen={!!selectedDn} onClose={() => setSelectedDn(null)} title={selectedDn?.deliveryNumber || 'Delivery Note'} size="lg">
        {selectedDn && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Customer: {getCustomerName(selectedDn)}</p>
                <p className="text-sm text-slate-400">Date: {formatDate(selectedDn.createdAt)}</p>
                {selectedDn.deliveredAt && (
                  <p className="text-sm text-slate-400">Delivered: {formatDate(selectedDn.deliveredAt)}</p>
                )}
              </div>
              <AdminStatusBadge tone={toneForStatus(selectedDn.status)}>
                {formatStatusLabel(selectedDn.status)}
              </AdminStatusBadge>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-white mb-3">Items</h4>
              <div className="space-y-2">
                {selectedDn.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 bg-white/5 rounded-xl p-3">
                    <p className="text-white font-medium whitespace-normal break-words min-w-0 flex-1">{item.productName}</p>
                    <p className="shrink-0 text-slate-400">Qty: {item.quantity}</p>
                  </div>
                ))}
              </div>
            </div>

            {selectedDn.notes && <p className="text-slate-400 text-sm">Notes: {selectedDn.notes}</p>}

            <div className="flex flex-wrap gap-3">
              {selectedDn.status === 'pending' && (
                <Button
                  onClick={() => markDeliveredMutation.mutate(selectedDn._id)}
                  isLoading={markDeliveredMutation.isPending}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />Mark as Delivered
                </Button>
              )}
              <Button onClick={() => handleDownloadPdf(selectedDn._id)} variant="secondary">
                <Download className="w-4 h-4 mr-2" />Download PDF
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
