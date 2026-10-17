import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { unwrapResponse } from '../../lib/unwrap-response';
import { MarketerLayout } from '../../components/MarketerLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Pagination } from '../../components/ui/Pagination';
import { queryKeys } from '../../lib/query-keys';
import { useCurrency } from '../../hooks/useCurrency';
import { usePagination } from '../../hooks/usePagination';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../lib/error-utils';

interface Assignment {
  _id: string;
  productId?: { name?: string; sku?: string };
  assignedQuantity: number;
  assignedUnitPrice: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

interface AssignmentResponse {
  data: Assignment[];
  count: number;
}

export const MarketerReviewAssignmentsPage = () => {
  const queryClient = useQueryClient();
  const { format } = useCurrency();
  const { showSuccess, showError } = useToast();
  const pagination = usePagination({ initialLimit: 20 });

  const { data, isLoading } = useQuery<AssignmentResponse>({
    queryKey: queryKeys.marketer.assignments({ activeOnly: true, page: pagination.state.page, limit: pagination.state.limit }),
    queryFn: async () => {
      const response = await apiClient.get('/marketer/assignments', {
        params: { activeOnly: true, page: pagination.state.page, limit: pagination.state.limit },
      });
      return unwrapResponse(response.data, {} as AssignmentResponse);
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: string) => apiClient.patch(`/marketer/assignments/${id}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketer.all(), exact: false });
      showSuccess('Assignment accepted successfully');
    },
    onError: (error) => {
      showError(getErrorMessage(error, 'Failed to accept assignment'));
    },
  });

  const columns = [
    {
      key: 'product',
      header: 'Product',
      render: (item: Assignment) => (
        <span>{item.productId?.name || '-'} ({item.productId?.sku || '-'})</span>
      ),
    },
    { key: 'assignedQuantity', header: 'Assigned Qty' },
    {
      key: 'assignedUnitPrice',
      header: 'Unit Price',
      render: (item: Assignment) => <span>{format(item.assignedUnitPrice)}</span>,
    },
    {
      key: 'total',
      header: 'Total Value',
      render: (item: Assignment) => <span className="text-blue-600">{format(item.assignedUnitPrice * item.assignedQuantity)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Assignment) => (
        <span className={item.status === 'accepted' ? 'text-green-600' : 'text-yellow-600'}>{item.status}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (item: Assignment) => (
        <Button
          size="sm"
          onClick={() => acceptMutation.mutate(item._id)}
          isLoading={acceptMutation.isPending}
          disabled={item.status !== 'pending'}
        >
          Accept
        </Button>
      ),
    },
  ];

  return (
    <MarketerLayout title="Review Product Assignments">
      <div className="bg-slate-900/50 rounded-2xl border border-white/10 p-5">
        <Table
          data={data?.data || []}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No assignments to review"
        />
        {data?.count && data.count > 0 && (
          <Pagination
            meta={{
              page: pagination.state.page,
              limit: pagination.state.limit,
              total: data.count,
              pages: Math.ceil(data.count / pagination.state.limit),
              hasNext: pagination.state.page < Math.ceil(data.count / pagination.state.limit),
              hasPrev: pagination.state.page > 1,
            }}
            onPageChange={pagination.setPage}
            onLimitChange={pagination.setLimit}
          />
        )}
      </div>
    </MarketerLayout>
  );
};
