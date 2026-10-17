import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Package,
  Truck,
  XCircle,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { unwrapArray } from '../../lib/unwrap-response';
import { AdminLayout } from '../../components/AdminLayout';
import { BranchSelector } from '../../components/BranchSelector';
import { AdminPageHeader, AdminStatCard, AdminStatusBadge } from '../../components/admin';
import { AdminMobileBottomNav } from '../../components/admin/AdminMobileBottomNav';
import { Button } from '../../components/ui/Button';
import { Error } from '../../components/ui/Error';
import { Input } from '../../components/ui/Input';
import { Loading } from '../../components/ui/Loading';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Table } from '../../components/ui/Table';
import { Textarea } from '../../components/ui/Textarea';
import { useToast } from '../../hooks/useToast';
import { buildApiUrl } from '../../lib/api-utils';
import { formatDate, formatDateTime } from '../../lib/date-format';
import { getErrorMessage } from '../../lib/error-utils';
import { formatStatusLabel, toneForStatus } from '../../lib/admin-tones';
import { queryKeys } from '../../lib/query-keys';
import { getBranchId, useBranchStore } from '../../stores/branch-store';

interface Branch {
  _id: string;
  name: string;
  code: string;
}

interface Product {
  _id: string;
  name: string;
  sku: string;
  quantityAvailable: number;
}

interface Transfer {
  _id: string;
  sourceBranchId: {
    _id: string;
    name: string;
  };
  destinationBranchId: {
    _id: string;
    name: string;
  };
  productId: {
    _id: string;
    name: string;
    sku: string;
  };
  quantity: number;
  reason: string;
  transferType: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  requestedBy: {
    firstName: string;
    lastName: string;
  };
  approvedBy?: {
    firstName: string;
    lastName: string;
  };
  rejectionReason?: string;
  createdAt: string;
  completedAt?: string;
  notes?: string;
}

interface TransferFormData {
  destinationBranchId: string;
  productId: string;
  quantity: number;
  reason: string;
}

const decisionStyles = {
  approved: {
    icon: CheckCircle2,
    labelClass: 'text-emerald-400',
    iconClass: 'border-emerald-400 text-emerald-400',
  },
  rejected: {
    icon: XCircle,
    labelClass: 'text-red-400',
    iconClass: 'border-red-400 text-red-400',
  },
  completed: {
    icon: CheckCircle2,
    labelClass: 'text-blue-400',
    iconClass: 'border-blue-400 text-blue-400',
  },
} as const;

function TransferRoute({ transfer }: { transfer: Transfer }) {
  return (
    <div className="space-y-1.5 text-sm">
      <p className="font-medium text-white">{transfer.sourceBranchId.name}</p>
      <div className="flex items-center gap-2">
        <ArrowRight className="h-4 w-4 shrink-0 text-amber-400" />
        <p className="font-medium text-white">{transfer.destinationBranchId.name}</p>
      </div>
      <p className="pt-1 font-semibold text-white">{transfer.quantity.toLocaleString()} units</p>
    </div>
  );
}

function PendingTransferRow({ transfer, onReview }: { transfer: Transfer; onReview: (transfer: Transfer) => void }) {
  return (
    <article className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] gap-x-4 gap-y-3 px-3 py-4">
      <div className="min-w-0">
        <h3 className="text-sm font-bold leading-5 text-white">{transfer.productId.name}</h3>
        <p className="mt-1 text-xs text-slate-400">SKU: {transfer.productId.sku}</p>
      </div>
      <TransferRoute transfer={transfer} />
      <div className="min-w-0 text-xs">
        <p className="font-medium text-white">{transfer.requestedBy.firstName} {transfer.requestedBy.lastName}</p>
        <p className="mt-1 text-xs text-slate-400">{formatDate(transfer.createdAt)}</p>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{transfer.reason}</p>
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className="w-fit rounded-full border border-amber-400/35 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
          Pending
        </span>
        <Button
          variant="secondary"
          size="sm"
          className="!rounded-full !border-amber-400 !bg-transparent !px-3 !text-amber-300 hover:!bg-amber-400/10"
          onClick={() => onReview(transfer)}
        >
          Review
        </Button>
      </div>
    </article>
  );
}

function DecisionTransferRow({ transfer }: { transfer: Transfer }) {
  const style = decisionStyles[transfer.status as keyof typeof decisionStyles] ?? decisionStyles.completed;
  const StatusIcon = style.icon;
  const reviewer = transfer.approvedBy
    ? `${transfer.approvedBy.firstName} ${transfer.approvedBy.lastName}`
    : null;

  return (
    <article className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] gap-x-4 gap-y-3 px-3 py-4">
      <div className="min-w-0">
        <div className={`mb-2 flex items-center gap-2 text-xs font-bold capitalize ${style.labelClass}`}>
          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${style.iconClass}`}>
            <StatusIcon className="h-4 w-4" />
          </span>
          {formatStatusLabel(transfer.status)}
        </div>
        <h3 className="text-sm font-medium leading-5 text-white">{transfer.productId.name}</h3>
        <p className="mt-1 text-xs text-slate-400">SKU: {transfer.productId.sku}</p>
      </div>
      <TransferRoute transfer={transfer} />
      <div className="min-w-0 text-sm">
        <p className="font-medium text-white">{transfer.requestedBy.firstName} {transfer.requestedBy.lastName}</p>
        <p className="mt-1 text-xs text-slate-400">{formatDate(transfer.createdAt)}</p>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{transfer.reason}</p>
      </div>
      <div className="min-w-0 text-xs leading-5 text-slate-400">
        <p className={`font-bold capitalize ${style.labelClass}`}>{formatStatusLabel(transfer.status)}</p>
        {reviewer ? <p>by {reviewer}</p> : null}
        {transfer.status === 'rejected' && transfer.rejectionReason ? (
          <p className="mt-1"><span className="font-semibold text-red-400">Reason:</span> {transfer.rejectionReason}</p>
        ) : transfer.notes ? (
          <p className="mt-1"><span className={`font-semibold ${style.labelClass}`}>Notes:</span> {transfer.notes}</p>
        ) : transfer.completedAt ? (
          <p className="mt-1">{formatDate(transfer.completedAt)}</p>
        ) : null}
      </div>
    </article>
  );
}

export default function TransferManagementPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const { selectedBranch } = useBranchStore();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TransferFormData>();
  const branchId = getBranchId(selectedBranch);

  const { data: branches } = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: async () => {
      const response = await apiClient.get('/branches');
      return unwrapArray<Branch>(response.data);
    },
  });

  const { data: products } = useQuery({
    queryKey: queryKeys.products.list({ branchId, limit: 1000 }),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/products', { branchId, limit: 1000 }));
      const payload = response.data?.data ?? response.data;
      return (Array.isArray(payload) ? payload : []) as Product[];
    },
    enabled: !!branchId,
  });

  const { data: transfers, isLoading: transfersLoading, error: transfersError } = useQuery({
    queryKey: queryKeys.transfers.list({ branchId }),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/transfers', { branchId }));
      const payload = response.data?.data ?? response.data;
      return (Array.isArray(payload) ? payload : []) as Transfer[];
    },
    enabled: !!branchId,
  });

  const createTransferMutation = useMutation({
    mutationFn: async (data: TransferFormData) =>
      apiClient.post('/transfers', {
        ...data,
        sourceBranchId: branchId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transfers.all(), exact: false });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all(), exact: false });
      setIsCreateModalOpen(false);
      reset();
      showSuccess('Transfer request created');
    },
    onError: (err: unknown) =>
      showError(getErrorMessage(err, 'Failed to create transfer')),
  });

  const approveTransferMutation = useMutation({
    mutationFn: async ({ transferId, notes }: { transferId: string; notes?: string }) =>
      apiClient.patch(`/transfers/${transferId}/approve`, {
        notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transfers.all(), exact: false });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all(), exact: false });
      setIsApprovalModalOpen(false);
      setSelectedTransfer(null);
      setApprovalNotes('');
      showSuccess('Transfer approved');
    },
    onError: (err: unknown) =>
      showError(getErrorMessage(err, 'Failed to approve transfer')),
  });

  const rejectTransferMutation = useMutation({
    mutationFn: async ({
      transferId,
      notes,
      rejectionReason: reason,
    }: {
      transferId: string;
      notes?: string;
      rejectionReason: string;
    }) =>
      apiClient.patch(`/transfers/${transferId}/reject`, {
        rejectionReason: reason,
        notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.transfers.all(), exact: false });
      setIsApprovalModalOpen(false);
      setSelectedTransfer(null);
      setApprovalNotes('');
      setRejectionReason('');
      showSuccess('Transfer rejected');
    },
    onError: (err: unknown) =>
      showError(getErrorMessage(err, 'Failed to reject transfer')),
  });

  const onSubmit = (data: TransferFormData) => {
    createTransferMutation.mutate({
      ...data,
      quantity: Number(data.quantity),
    });
  };

  const handleOpenReview = (transfer: Transfer) => {
    setSelectedTransfer(transfer);
    setApprovalNotes('');
    setRejectionReason('');
    setIsApprovalModalOpen(true);
  };

  const transferColumns = [
    {
      key: 'createdAt',
      header: 'Date',
      render: (transfer: Transfer) => (
        <span className="text-slate-300">
          {formatDate(transfer.createdAt)}
        </span>
      ),
    },
    {
      key: 'sourceBranchId.name',
      header: 'From',
      render: (transfer: Transfer) => (
        <span className="text-white">{transfer.sourceBranchId.name}</span>
      ),
    },
    {
      key: 'destinationBranchId.name',
      header: 'To',
      render: (transfer: Transfer) => (
        <span className="text-white">{transfer.destinationBranchId.name}</span>
      ),
    },
    {
      key: 'productId.name',
      header: 'Product',
      render: (transfer: Transfer) => (
        <div className="min-w-0">
          <p className="text-white">{transfer.productId.name}</p>
          <p className="text-xs text-slate-500">{transfer.productId.sku}</p>
        </div>
      ),
      className: 'whitespace-normal',
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (transfer: Transfer) => (
        <span className="text-white">{transfer.quantity}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (transfer: Transfer) => (
        <AdminStatusBadge tone={toneForStatus(transfer.status)}>
          {formatStatusLabel(transfer.status)}
        </AdminStatusBadge>
      ),
    },
    {
      key: 'requestedBy',
      header: 'Requested By',
      render: (transfer: Transfer) => (
        <span className="text-slate-300">
          {transfer.requestedBy.firstName} {transfer.requestedBy.lastName}
        </span>
      ),
      className: 'whitespace-normal',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (transfer: Transfer) =>
        transfer.status === 'pending' ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenReview(transfer)}
          >
            Review
          </Button>
        ) : null,
    },
  ];

  if (!selectedBranch) {
    return (
      <AdminLayout title="Transfer Management">
        <div className="rounded-xl border border-white/10 bg-slate-900/65 py-12 text-center text-slate-400">
          Please select a branch to manage transfers.
        </div>
      </AdminLayout>
    );
  }

  if (transfersLoading) {
    return (
      <AdminLayout title="Transfer Management">
        <Loading />
      </AdminLayout>
    );
  }

  if (transfersError) {
    return (
      <AdminLayout title="Transfer Management">
        <Error message="Failed to load transfers" />
      </AdminLayout>
    );
  }

  const safeTransfers = transfers || [];
  const pendingTransfers = safeTransfers.filter((transfer) => transfer.status === 'pending');
  const decidedTransfers = safeTransfers.filter((transfer) => transfer.status !== 'pending');

  return (
    <AdminLayout title="Stock Transfers" showMobileBranchSelector={false}>
      <div className="space-y-6 pb-24 lg:pb-0">
        <div className="space-y-4 lg:hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_9.5rem] items-end gap-3">
            <div className="flex min-h-14 items-center rounded-2xl border border-emerald-400/25 bg-slate-900/60 p-3 [&_label]:sr-only [&_select]:!px-3 [&_select]:!text-sm">
              <BranchSelector />
            </div>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="!min-h-14 !rounded-2xl !border-amber-300 !bg-amber-400 !px-3 !text-sm !font-bold !text-slate-950 hover:!bg-amber-300"
            >
              + New Transfer
            </Button>
          </div>

          {safeTransfers.length === 0 ? (
            <div className="rounded-2xl border border-emerald-400/25 bg-slate-900/60 px-5 py-12 text-center">
              <p className="text-sm font-semibold text-white">No transfer requests yet</p>
              <p className="mt-2 text-sm text-slate-400">Create the first stock transfer for this branch.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <section className="overflow-hidden rounded-2xl border border-emerald-400/30 bg-slate-900/55">
                <header className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <ClipboardCheck className="h-6 w-6 text-amber-400" />
                    <h2 className="text-base font-bold text-amber-300">Needs review</h2>
                  </div>
                  <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-amber-400/10 px-2 text-sm font-bold text-amber-300">
                    {pendingTransfers.length}
                  </span>
                </header>
                {pendingTransfers.length > 0 ? (
                  <div className="divide-y divide-white/10">
                    {pendingTransfers.map((transfer) => (
                      <PendingTransferRow key={transfer._id} transfer={transfer} onReview={handleOpenReview} />
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">No transfers need review.</p>
                )}
              </section>

              <section className="overflow-hidden rounded-2xl border border-emerald-400/30 bg-slate-900/55">
                <header className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                    <h2 className="text-base font-bold text-emerald-400">Recent decisions</h2>
                  </div>
                  <span className="flex h-9 min-w-9 items-center justify-center rounded-full bg-emerald-400/10 px-2 text-sm font-bold text-emerald-400">
                    {decidedTransfers.length}
                  </span>
                </header>
                {decidedTransfers.length > 0 ? (
                  <div className="divide-y divide-white/10">
                    {decidedTransfers.map((transfer) => (
                      <DecisionTransferRow key={transfer._id} transfer={transfer} />
                    ))}
                  </div>
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">No recent decisions.</p>
                )}
              </section>
            </div>
          )}
        </div>

        <div className="hidden space-y-6 lg:block">
        <AdminPageHeader
          title="Transfer Management"
          subtitle="Move product stock between branches without dealing with batch records."
          actions={
            <Button onClick={() => setIsCreateModalOpen(true)}>Create Transfer Request</Button>
          }
        />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <AdminStatCard
            label="Total transfers"
            value={safeTransfers.length}
            tone="accent"
            icon={<Truck className="h-5 w-5" aria-hidden="true" />}
          />
          <AdminStatCard
            label="Pending"
            value={safeTransfers.filter((transfer) => transfer.status === 'pending').length}
            tone="warning"
            icon={<ClipboardCheck className="h-5 w-5" aria-hidden="true" />}
          />
          <AdminStatCard
            label="Completed"
            value={safeTransfers.filter((transfer) => transfer.status === 'completed').length}
            tone="success"
            icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
          />
          <AdminStatCard
            label="Active branch"
            value={selectedBranch.name}
            tone="info"
            icon={<Package className="h-5 w-5" aria-hidden="true" />}
          />
        </div>

        <Table data={safeTransfers} columns={transferColumns} title="Transfer History" />
        </div>

        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            reset();
          }}
          title="Create Transfer Request"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Select
              label="Destination Branch"
              {...register('destinationBranchId', {
                required: 'Destination branch is required',
              })}
              error={errors.destinationBranchId?.message}
            >
              <option value="" className="bg-slate-900 text-white">
                Select destination branch
              </option>
              {branches
                ?.filter((branch) => branch._id !== branchId)
                .map((branch) => (
                  <option
                    key={branch._id}
                    value={branch._id}
                    className="bg-slate-900 text-white"
                  >
                    {branch.name} ({branch.code})
                  </option>
                ))}
            </Select>

            <Select
              label="Product"
              {...register('productId', { required: 'Product is required' })}
              error={errors.productId?.message}
            >
              <option value="" className="bg-slate-900 text-white">
                Select product
              </option>
              {products?.map((product) => (
                <option
                  key={product._id}
                  value={product._id}
                  className="bg-slate-900 text-white"
                >
                  {product.name} ({product.sku}) - Available: {product.quantityAvailable}
                </option>
              ))}
            </Select>

            <Input
              label="Quantity"
              type="number"
              min="1"
              {...register('quantity', {
                required: 'Quantity is required',
                min: { value: 1, message: 'Quantity must be at least 1' },
              })}
              error={errors.quantity?.message}
            />

            <div>
              <Textarea
                label="Reason for Transfer"
                required
                {...register('reason', { required: 'Reason is required' })}
                rows={3}
                placeholder="Explain the reason for this stock transfer"
                error={errors.reason?.message}
              />
            </div>

            <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end border-t border-white/[0.08]">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                isLoading={createTransferMutation.isPending}
              >
                Create Transfer
              </Button>
            </div>

            {createTransferMutation.isError ? (
              <Error message="Failed to create transfer. Please try again." />
            ) : null}
          </form>
        </Modal>

        <Modal
          isOpen={isApprovalModalOpen}
          onClose={() => {
            setIsApprovalModalOpen(false);
            setSelectedTransfer(null);
            setApprovalNotes('');
            setRejectionReason('');
          }}
          title="Review Transfer Request"
        >
          {selectedTransfer ? (
            <div className="space-y-4">
              <div className="space-y-2 rounded-xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-300">
                <p><span className="font-semibold text-white">From:</span> {selectedTransfer.sourceBranchId.name}</p>
                <p><span className="font-semibold text-white">To:</span> {selectedTransfer.destinationBranchId.name}</p>
                <p><span className="font-semibold text-white">Product:</span> {selectedTransfer.productId.name}</p>
                <p><span className="font-semibold text-white">Quantity:</span> {selectedTransfer.quantity}</p>
                <p><span className="font-semibold text-white">Reason:</span> {selectedTransfer.reason}</p>
                {selectedTransfer.transferType && <p><span className="font-semibold text-white">Type:</span> {selectedTransfer.transferType}</p>}
                {selectedTransfer.rejectionReason && <p><span className="font-semibold text-white">Rejection Reason:</span> {selectedTransfer.rejectionReason}</p>}
                <p><span className="font-semibold text-white">Requested By:</span> {selectedTransfer.requestedBy.firstName} {selectedTransfer.requestedBy.lastName}</p>
                <p><span className="font-semibold text-white">Date:</span> {formatDateTime(selectedTransfer.createdAt)}</p>
              </div>

              <Textarea
                label="Rejection Reason"
                required
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                rows={2}
                placeholder="Provide reason for rejecting this transfer"
              />

              <Textarea
                label="Notes (Optional)"
                value={approvalNotes}
                onChange={(event) => setApprovalNotes(event.target.value)}
                rows={3}
                placeholder="Add any notes about this decision"
              />

              <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsApprovalModalOpen(false);
                    setSelectedTransfer(null);
                    setApprovalNotes('');
                    setRejectionReason('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => {
                    if (!selectedTransfer || !rejectionReason.trim()) {
                      return;
                    }
                    rejectTransferMutation.mutate({
                      transferId: selectedTransfer._id,
                      rejectionReason: rejectionReason.trim(),
                      notes: approvalNotes,
                    });
                  }}
                  disabled={!rejectionReason.trim() || approveTransferMutation.isPending}
                  isLoading={rejectTransferMutation.isPending}
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (!selectedTransfer) {
                      return;
                    }
                    approveTransferMutation.mutate({
                      transferId: selectedTransfer._id,
                      notes: approvalNotes,
                    });
                  }}
                  disabled={rejectTransferMutation.isPending}
                  isLoading={approveTransferMutation.isPending}
                >
                  Approve
                </Button>
              </div>

              {approveTransferMutation.isError || rejectTransferMutation.isError ? (
                <Error message="Failed to process transfer. Please try again." />
              ) : null}
            </div>
          ) : null}
        </Modal>
      </div>
      <AdminMobileBottomNav active="inventory" />
    </AdminLayout>
  );
}
