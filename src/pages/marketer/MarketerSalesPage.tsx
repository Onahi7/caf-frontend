import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { unwrapResponse } from '../../lib/unwrap-response';
import { MarketerLayout } from '../../components/MarketerLayout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Table } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { queryKeys } from '../../lib/query-keys';
import { formatDateTime } from '../../lib/date-format';
import { useCurrency } from '../../hooks/useCurrency';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../lib/error-utils';
import { CustomerTypeahead } from '../../components/ui/CustomerTypeahead';

interface Assignment {
  _id: string;
  productId?: { _id?: string; name?: string; sku?: string; brand?: string };
  assignedUnitPrice: number;
  remainingQuantity: number;
  status: 'pending' | 'accepted' | 'rejected';
}

interface AssignmentResponse {
  data: Assignment[];
  count: number;
}

interface SalesResponse {
  data: Array<{
    _id: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    soldAt: string;
    customerName?: string;
    productId?: { name?: string; sku?: string; brand?: string };
  }>;
  count: number;
}

export const MarketerSalesPage = () => {
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const pagination = usePagination({ initialLimit: 20 });

  const [assignmentId, setAssignmentId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');

  const { data: assignments } = useQuery<AssignmentResponse>({
    queryKey: queryKeys.marketer.assignments({ activeOnly: true, status: 'accepted' }),
    queryFn: async () => {
      const response = await apiClient.get('/marketer/assignments', {
        params: { activeOnly: true, status: 'accepted' },
      });
      return unwrapResponse(response.data, {} as AssignmentResponse);
    },
  });

  const { data: salesData, isLoading } = useQuery<SalesResponse>({
    queryKey: queryKeys.marketer.sales({ page: pagination.state.page, limit: pagination.state.limit }),
    queryFn: async () => {
      const response = await apiClient.get('/marketer/sales', {
        params: { page: pagination.state.page, limit: pagination.state.limit },
      });
      return unwrapResponse(response.data, {} as SalesResponse);
    },
  });

  const selectedAssignment = useMemo(
    () => (assignments?.data || []).find((item) => item._id === assignmentId),
    [assignments, assignmentId],
  );

  const createSaleMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post('/marketer/sales', {
        assignmentId,
        quantity: Number(quantity),
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        customerId: customerId || undefined,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketer.all(), exact: false });
      showSuccess('Sale recorded successfully');
      setAssignmentId('');
      setQuantity('1');
      setCustomerName('');
      setCustomerPhone('');
      setCustomerId(undefined);
      setNotes('');
    },
    onError: (error) => {
      showError(getErrorMessage(error, 'Failed to record sale'));
    },
  });

  const columns = [
    {
      key: 'product',
      header: 'Product',
      render: (item: SalesResponse['data'][number]) => {
        const brand = item.productId?.brand?.trim();
        const showBrand = brand && brand.toLowerCase() !== 'unknown';
        return (
          <div className="whitespace-normal break-words">
            <div className="font-medium text-white">{item.productId?.name || '-'} <span className="text-slate-400 font-normal">({item.productId?.sku || '-'})</span></div>
            {showBrand ? <div className="text-xs text-emerald-500">Brand: {brand}</div> : null}
          </div>
        );
      },
    },
    { key: 'quantity', header: 'Quantity' },
    {
      key: 'unitPrice',
      header: 'Unit Price',
      render: (item: SalesResponse['data'][number]) => <span>{format(item.unitPrice)}</span>,
    },
    {
      key: 'totalAmount',
      header: 'Total',
      render: (item: SalesResponse['data'][number]) => <span className="text-emerald-400">{format(item.totalAmount)}</span>,
    },
    {
      key: 'soldAt',
      header: 'Date',
      render: (item: SalesResponse['data'][number]) => <span>{formatDateTime(item.soldAt)}</span>,
    },
  ];

  return (
    <MarketerLayout title="Sell Assigned Products">
      <div className="space-y-5">
        <div className="bg-slate-900/50 rounded-2xl border border-white/10 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Create Sale</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Assigned Product"
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              options={[
                { value: '', label: 'Select assignment' },
                ...(assignments?.data || []).map((item) => {
                  const brand = item.productId?.brand?.trim();
                  const showBrand = brand && brand.toLowerCase() !== 'unknown';
                  const label = showBrand
                    ? `${item.productId?.name || 'Product'} - ${brand} (Rem: ${item.remainingQuantity})`
                    : `${item.productId?.name || 'Product'} (Rem: ${item.remainingQuantity})`;
                  return { value: item._id, label };
                }),
              ]}
            />

            <Input
              label="Quantity"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min={1}
              max={selectedAssignment?.remainingQuantity || undefined}
            />

            <div className="md:col-span-2">
              <CustomerTypeahead
                label="Customer Name"
                value={customerName}
                onChange={setCustomerName}
                onSelectCustomer={(c) => {
                  setCustomerId(c._id);
                  if (!customerPhone.trim() && c.phone) setCustomerPhone(c.phone);
                }}
                onClearCustomer={() => setCustomerId(undefined)}
                selectedCustomerId={customerId}
                placeholder="Search customer or type walk-in name..."
                helperText="Optional. Pick an existing customer to link this sale, or type a name for a walk-in."
              />
            </div>
            <Input label="Customer Phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-white/60">
              Unit Price: {selectedAssignment ? format(selectedAssignment.assignedUnitPrice) : '-'}
            </div>
            <Button
              onClick={() => createSaleMutation.mutate()}
              isLoading={createSaleMutation.isPending}
              disabled={!assignmentId || !quantity || Number(quantity) <= 0}
            >
              Record Sale
            </Button>
          </div>
        </div>

        <div className="bg-slate-900/50 rounded-2xl border border-white/10 p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Recent Sales</h3>
          <Table
            data={salesData?.data || []}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No sales recorded yet"
          />
          {salesData?.count && salesData.count > 0 && (
            <Pagination
              meta={{
                page: pagination.state.page,
                limit: pagination.state.limit,
                total: salesData.count,
                pages: Math.ceil(salesData.count / pagination.state.limit),
                hasNext: pagination.state.page < Math.ceil(salesData.count / pagination.state.limit),
                hasPrev: pagination.state.page > 1,
              }}
              onPageChange={pagination.setPage}
              onLimitChange={pagination.setLimit}
            />
          )}
        </div>
      </div>
    </MarketerLayout>
  );
};
