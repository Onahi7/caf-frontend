import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { AdminStatusBadge } from '../../components/admin';
import { BranchSelector } from '../../components/BranchSelector';
import { useToast } from '../../hooks/useToast';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useCurrency } from '../../hooks/useCurrency';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { formatStatusLabel, toneForStatus } from '../../lib/admin-tones';
import { FileText, Upload, CheckCircle, XCircle, Eye } from 'lucide-react';

interface CustomerOrderItem {
  extractedName: string;
  extractedQuantity: number;
  extractedUnitPrice?: number;
  matchedProductId?: string;
  status: string;
}

interface CustomerOrder {
  _id: string;
  orderNumber: string;
  branchId: string;
  sourceFile: { originalName: string; url: string };
  items: CustomerOrderItem[];
  unmatchedItems: { name: string; quantity: number }[];
  status: string;
  createdAt: string;
}

export function CustomerOrdersPage() {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(null);
  const [uploading, setUploading] = useState(false);
  const { selectedBranch } = useBranchStore();
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const branchId = getBranchId(selectedBranch);

  const { data: orders, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.customerOrders.list({ branchId }),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/customer-orders', { branchId }));
      const payload = response.data?.data ?? response.data;
      return (Array.isArray(payload) ? payload : []) as CustomerOrder[];
    },
    enabled: !!branchId,
  });

  const handleFileUpload = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem('file') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file || !branchId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.post(`/customer-orders/upload?branchId=${branchId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showSuccess('Purchase order uploaded and processed');
      setIsUploadModalOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.customerOrders.lists() });
    } catch (err: any) {
      showError(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [branchId, queryClient, showSuccess, showError]);

  const columns = [
    { key: 'orderNumber', header: 'Order #' },
    { key: 'sourceFile', header: 'File',
      render: (item: CustomerOrder) => item.sourceFile?.originalName || '-' },
    {
      key: 'items', header: 'Items',
      render: (item: CustomerOrder) => `${item.items?.length || 0} matched` },
    {
      key: 'unmatchedItems', header: 'Unmatched',
      render: (item: CustomerOrder) => item.unmatchedItems?.length
        ? <span className="text-amber-400 font-semibold">{item.unmatchedItems.length}</span>
        : '0',
    },
    {
      key: 'status', header: 'Status',
      render: (item: CustomerOrder) => (
        <AdminStatusBadge tone={toneForStatus(item.status)}>
          {formatStatusLabel(item.status)}
        </AdminStatusBadge>
      ),
    },
    {
      key: 'createdAt', header: 'Date',
      render: (item: CustomerOrder) => new Date(item.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <AdminLayout title="Customer Orders">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Customer Orders</h1>
            <p className="text-sm text-slate-400 mt-1">Upload and manage institutional purchase orders via AI parsing</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <BranchSelector />
            <Button
              onClick={() => setIsUploadModalOpen(true)}
              disabled={!branchId}
              className="inline-flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Upload PO</span>
            </Button>
          </div>
        </div>

        {!branchId ? (
          <div className="max-w-md mx-auto text-center py-16 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <FileText className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Select a Branch</h2>
            <p className="text-sm text-slate-400 mb-6">
              Purchase orders are tracked per branch. Choose a branch to review and process customer orders.
            </p>
            <div className="flex justify-center">
              <BranchSelector />
            </div>
          </div>
        ) : (
          <>
            {isLoading ? (
              <Loading variant="centered" text="Loading orders..." />
            ) : error ? (
              <Error message="Failed to load customer orders" onRetry={refetch} />
            ) : (
              <Table
                data={orders || []}
                columns={columns}
                emptyMessage="No purchase orders yet. Upload one to get started."
                onRowClick={(item) => setSelectedOrder(item)}
              />
            )}
          </>
        )}

        <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Upload Purchase Order">
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-1">File (PDF, Excel, Word, Image)</label>
              <input
                type="file"
                name="file"
                accept=".pdf,.xlsx,.xls,.docx,.png,.jpg,.jpeg"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 text-white border border-slate-700 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <p className="text-sm text-slate-400">The file will be uploaded to cloud storage and processed with AI to extract line items.</p>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <Button type="button" variant="secondary" onClick={() => setIsUploadModalOpen(false)}>Cancel</Button>
              <Button type="submit" isLoading={uploading}>Upload & Process</Button>
            </div>
          </form>
        </Modal>

        <Modal isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={selectedOrder?.orderNumber || 'Order Detail'} size="lg">
          {selectedOrder && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <p className="text-sm font-medium text-white">File: {selectedOrder.sourceFile?.originalName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Date: {new Date(selectedOrder.createdAt).toLocaleDateString()}</p>
                </div>
                <AdminStatusBadge tone={toneForStatus(selectedOrder.status)}>
                  {formatStatusLabel(selectedOrder.status)}
                </AdminStatusBadge>
              </div>

              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">Matched Items</h4>
                {selectedOrder.items.length === 0 ? (
                  <p className="text-slate-400 text-sm">No items matched yet</p>
                ) : (
                  <div className="space-y-2">
                    {selectedOrder.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-3">
                        <div>
                          <p className="text-white font-medium text-sm">{item.extractedName}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Qty: {item.extractedQuantity}
                            {item.extractedUnitPrice ? ` @ ${format(item.extractedUnitPrice)}` : ''}
                          </p>
                        </div>
                        <AdminStatusBadge tone={toneForStatus(item.status)}>
                          {formatStatusLabel(item.status)}
                        </AdminStatusBadge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedOrder.unmatchedItems?.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-amber-400 mb-3">Unmatched Items</h4>
                  <div className="space-y-2">
                    {selectedOrder.unmatchedItems.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-amber-500/5 rounded-xl p-3 border border-amber-500/20">
                        <p className="text-sm text-white">{item.name}</p>
                        <span className="text-xs font-semibold text-amber-300">Qty: {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                {selectedOrder.sourceFile?.url && (
                  <a href={selectedOrder.sourceFile.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="secondary" className="inline-flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      <span>View Original File</span>
                    </Button>
                  </a>
                )}
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AdminLayout>
  );
}

export default CustomerOrdersPage;
