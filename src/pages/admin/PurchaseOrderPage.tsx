import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { AdminPageHeader, AdminStatusBadge } from '../../components/admin';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useToast } from '../../hooks/useToast';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuth } from '../../contexts/AuthContext';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { useCurrency } from '../../hooks/useCurrency';
import { unwrapArray } from '../../lib/unwrap-response';
import { getErrorMessage } from '../../lib/error-utils';
import { formatDate } from '../../lib/date-format';
import { formatStatusLabel, toneForStatus } from '../../lib/admin-tones';
import { BranchSelector } from '../../components/BranchSelector';
import { AdminMobileBottomNav } from '../../components/admin/AdminMobileBottomNav';
import { CheckCircle2, ChevronRight, Clock3, Truck, XCircle, type LucideIcon } from 'lucide-react';

interface Supplier {
  _id: string;
  name: string;
}

interface Product {
  _id: string;
  name: string;
  sku: string;
}

interface PurchaseOrder {
  _id: string;
  orderNumber: string;
  supplierId: {
    _id: string;
    name: string;
  };
  branchId: {
    _id: string;
    name: string;
  };
  items: {
    productId: {
      _id: string;
      name: string;
      sku: string;
    };
    quantity: number;
    unitPrice: number;
  }[];
  totalAmount: number;
  status: 'pending' | 'partially_received' | 'completed' | 'cancelled';
  expectedDeliveryDate: string;
  receivedAt?: string;
  createdAt: string;
}

interface POFormData {
  supplierId: string;
  expectedDeliveryDate: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
  }[];
}

interface ReceiveFormData {
  receivedItems: {
    productId: string;
    receivedQuantity: number;
    purchasePrice?: number;
    expiryDate: string;
    sellingPrice?: number;
    supplyDate?: string;
  }[];
}

interface PurchaseOrderQueueSectionProps {
  title: string;
  orders: PurchaseOrder[];
  icon: LucideIcon;
  tone: 'due' | 'partial' | 'complete' | 'cancelled';
  formatAmount: (amount: number) => string;
  onReceive: (order: PurchaseOrder) => void;
}

const queueToneClasses = {
  due: {
    heading: 'text-amber-300',
    icon: 'text-amber-300',
    count: 'bg-amber-400/10 text-amber-300',
    date: 'text-amber-300',
    action: '!border-amber-400/70 !bg-amber-400/5 !text-amber-300 hover:!bg-amber-400/15',
  },
  partial: {
    heading: 'text-blue-400',
    icon: 'text-blue-400',
    count: 'bg-blue-500/10 text-blue-400',
    date: 'text-blue-400',
    action: '!border-blue-400/70 !bg-blue-400/5 !text-blue-400 hover:!bg-blue-400/15',
  },
  complete: {
    heading: 'text-emerald-300',
    icon: 'text-emerald-300',
    count: 'bg-emerald-400/10 text-emerald-300',
    date: 'text-emerald-300',
    action: '',
  },
  cancelled: {
    heading: 'text-rose-300',
    icon: 'text-rose-300',
    count: 'bg-rose-400/10 text-rose-300',
    date: 'text-rose-300',
    action: '',
  },
};

function PurchaseOrderQueueSection({
  title,
  orders,
  icon: Icon,
  tone,
  formatAmount,
  onReceive,
}: PurchaseOrderQueueSectionProps) {
  if (orders.length === 0) return null;

  const toneClasses = queueToneClasses[tone];

  return (
    <section className="overflow-hidden rounded-2xl border border-emerald-400/25 bg-slate-900/65 shadow-xl shadow-black/10">
      <div className="flex min-h-14 items-center gap-3 border-b border-white/10 px-4 py-3">
        <Icon className={`h-6 w-6 ${toneClasses.icon}`} strokeWidth={2} aria-hidden="true" />
        <h2 className={`flex-1 text-base font-bold ${toneClasses.heading}`}>{title}</h2>
        <span className={`flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-bold ${toneClasses.count}`}>
          {orders.length}
        </span>
      </div>
      <div className="divide-y divide-white/10">
        {orders.map((order) => {
          const canReceive = order.status === 'pending' || order.status === 'partially_received';
          const dateLabel = order.status === 'completed' && order.receivedAt ? 'Received' : 'Expected';
          const dateValue = order.status === 'completed' && order.receivedAt
            ? order.receivedAt
            : order.expectedDeliveryDate;
          const statusTone = order.status === 'partially_received'
            ? 'info'
            : toneForStatus(order.status);

          return (
            <article
              key={order._id}
              className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,.9fr)_auto] items-center gap-2.5 px-4 py-3"
            >
              <div className="min-w-0">
                <h3 className="truncate text-[13px] font-bold text-white">{order.orderNumber}</h3>
                <p className="mt-1 truncate text-[11px] text-slate-300">{order.supplierId?.name || 'Unknown supplier'}</p>
                <p className="mt-1 text-[10px] text-slate-500">{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</p>
              </div>
              <div className="min-w-0">
                <p
                  className="break-words text-xs font-bold text-white tabular-nums leading-tight"
                  title={formatAmount(order.totalAmount)}
                >
                  {formatAmount(order.totalAmount)}
                </p>
                <p className="mt-1 text-[10px] text-slate-400">{dateLabel}</p>
                <p className={`mt-0.5 truncate text-[11px] font-medium ${toneClasses.date}`}>
                  {formatDate(dateValue)}
                </p>
              </div>
              <div className="flex min-w-[6rem] flex-col items-end gap-2">
                <div className="flex items-center gap-1">
                  <AdminStatusBadge tone={statusTone} className="max-w-24 justify-center !px-2 !py-1 text-center !text-[10px] leading-tight capitalize">
                    {formatStatusLabel(order.status)}
                  </AdminStatusBadge>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
                </div>
                {canReceive ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className={`!min-h-10 !px-3 !py-1.5 ${toneClasses.action}`}
                    onClick={() => onReceive(order)}
                  >
                    Receive
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function PurchaseOrderPage() {
  const { symbol, format } = useCurrency();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const { selectedBranch } = useBranchStore();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  const { register: registerCreate, handleSubmit: handleSubmitCreate, control: controlCreate, reset: resetCreate, formState: { errors: errorsCreate } } = useForm<POFormData>({
    defaultValues: {
      items: [{ productId: '', quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: controlCreate,
    name: 'items',
  });

  const { register: registerReceive, handleSubmit: handleSubmitReceive, reset: resetReceive } = useForm<ReceiveFormData>();

  // Commented out unused field array for now - can be enabled when receive functionality is implemented
  // const { fields: receiveFields, append: appendReceive, remove: removeReceive } = useFieldArray({
  //   control: controlReceive,
  //   name: 'receivedItems',
  // });

  // Fetch suppliers
  const { data: suppliers } = useQuery({
    queryKey: queryKeys.suppliers.list(),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/suppliers', { isActive: true }));
      return unwrapArray<Supplier>(response.data);
    },
  });

  // Fetch products (high limit so the dropdown is not truncated by pagination)
  const { data: products } = useQuery({
    queryKey: queryKeys.products.list({ branchId: getBranchId(selectedBranch), limit: 1000 }),
    queryFn: async () => {
      const branchId = getBranchId(selectedBranch);
      const response = await apiClient.get('/products', {
        params: branchId ? { branchId, limit: 1000 } : { limit: 1000 },
      });
      return unwrapArray<Product>(response.data);
    },
    enabled: !!selectedBranch,
  });

  // Fetch purchase orders
  const { data: purchaseOrders, isLoading, error } = useQuery({
    queryKey: queryKeys.purchaseOrders.list({ branchId: getBranchId(selectedBranch) }),
    queryFn: async () => {
      const branchId = getBranchId(selectedBranch);
      const response = await apiClient.get(buildApiUrl('/purchase-orders', { branchId }));
      return unwrapArray<PurchaseOrder>(response.data);
    },
    enabled: !!selectedBranch,
  });

  // Create PO mutation
  const createMutation = useMutation({
    mutationFn: async (data: POFormData) => {
      const branchId = getBranchId(selectedBranch);
      return apiClient.post('/purchase-orders', {
        ...data,
        branchId: branchId,
        createdBy: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all(), exact: false });
      setIsCreateModalOpen(false);
      resetCreate();
      showSuccess('Purchase order created');
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to create purchase order')),
  });

  // Receive PO mutation
  const receiveMutation = useMutation({
    mutationFn: async ({ poId, data }: { poId: string; data: ReceiveFormData }) => {
      return apiClient.post(`/purchase-orders/${poId}/receive`, {
        ...data,
        receivedBy: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all(), exact: false });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all(), exact: false });
      setIsReceiveModalOpen(false);
      setSelectedPO(null);
      resetReceive();
      showSuccess('Purchase order received');
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to receive order')),
  });

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
    resetCreate();
  };

  const handleOpenReceiveModal = (po: PurchaseOrder) => {
    setSelectedPO(po);
    resetReceive({
      receivedItems: po.items.map(item => ({
        productId: item.productId._id,
        receivedQuantity: item.quantity,
        purchasePrice: item.unitPrice,
        expiryDate: '',
        sellingPrice: undefined,
        supplyDate: new Date().toISOString().slice(0, 10),
      })),
    });
    setIsReceiveModalOpen(true);
  };

  const handleCloseReceiveModal = () => {
    setIsReceiveModalOpen(false);
    setSelectedPO(null);
    resetReceive();
  };

  const onSubmitCreate = (data: POFormData) => {
    createMutation.mutate(data);
  };

  const onSubmitReceive = (data: ReceiveFormData) => {
    if (selectedPO) {
      receiveMutation.mutate({ poId: selectedPO._id, data });
    }
  };

  if (!selectedBranch) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <p className="text-slate-400">Please select a branch to manage purchase orders</p>
        </div>
      </AdminLayout>
    );
  }

  if (isLoading) return <AdminLayout><Loading /></AdminLayout>;
  if (error) return <AdminLayout><Error message="Failed to load purchase orders" /></AdminLayout>;

  const columns = [
    { key: 'orderNumber', header: 'PO Number' },
    { 
      key: 'createdAt', 
      header: 'Date',
      render: (po: PurchaseOrder) => formatDate(po.createdAt)
    },
    {
      key: 'supplier',
      header: 'Supplier',
      render: (po: PurchaseOrder) => po.supplierId?.name || '-',
    },
    { 
      key: 'items', 
      header: 'Items',
      render: (po: PurchaseOrder) => po.items.length
    },
    { 
      key: 'totalAmount', 
      header: 'Total Amount',
      render: (po: PurchaseOrder) => format(po.totalAmount)
    },
    { 
      key: 'expectedDeliveryDate', 
      header: 'Expected Delivery',
      render: (po: PurchaseOrder) => formatDate(po.expectedDeliveryDate)
    },
    {
      key: 'status',
      header: 'Status',
      render: (po: PurchaseOrder) => (
        <AdminStatusBadge tone={toneForStatus(po.status)}>
          {formatStatusLabel(po.status)}
        </AdminStatusBadge>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (po: PurchaseOrder) => (
        po.status === 'pending' || po.status === 'partially_received' ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenReceiveModal(po)}
          >
            Receive
          </Button>
        ) : null
      ),
    },
  ];

  const orders = purchaseOrders || [];
  const dueOrders = orders.filter((order) => order.status === 'pending');
  const partiallyReceivedOrders = orders.filter((order) => order.status === 'partially_received');
  const completedOrders = orders.filter((order) => order.status === 'completed');
  const cancelledOrders = orders.filter((order) => order.status === 'cancelled');

  return (
    <AdminLayout title="Purchase Orders" showMobileBranchSelector={false}>
      <div className="space-y-6 pb-24 lg:pb-0">
        <div className="space-y-4 lg:hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_9.5rem] items-end gap-3">
            <div className="flex min-h-14 items-center rounded-2xl border border-emerald-400/25 bg-slate-900/60 p-3 [&_label]:sr-only [&_select]:!px-3 [&_select]:!text-sm">
              <BranchSelector />
            </div>
            <Button
              onClick={handleOpenCreateModal}
              className="!min-h-14 !rounded-2xl !border-amber-300 !bg-amber-400 !px-3 !text-sm !font-bold !text-slate-950 hover:!bg-amber-300"
            >
              + Create PO
            </Button>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-2xl border border-emerald-400/25 bg-slate-900/60 px-5 py-12 text-center">
              <p className="text-sm font-semibold text-white">No purchase orders yet</p>
              <p className="mt-2 text-sm text-slate-400">Create the first supplier order for this branch.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <PurchaseOrderQueueSection title="Due next" orders={dueOrders} icon={Clock3} tone="due" formatAmount={format} onReceive={handleOpenReceiveModal} />
              <PurchaseOrderQueueSection title="Partially received" orders={partiallyReceivedOrders} icon={Truck} tone="partial" formatAmount={format} onReceive={handleOpenReceiveModal} />
              <PurchaseOrderQueueSection title="Completed recently" orders={completedOrders} icon={CheckCircle2} tone="complete" formatAmount={format} onReceive={handleOpenReceiveModal} />
              <PurchaseOrderQueueSection title="Cancelled" orders={cancelledOrders} icon={XCircle} tone="cancelled" formatAmount={format} onReceive={handleOpenReceiveModal} />
            </div>
          )}
        </div>

        <div className="hidden space-y-6 lg:block">
          <AdminPageHeader
            title="Purchase Orders"
            actions={
              <Button onClick={handleOpenCreateModal}>Create Purchase Order</Button>
            }
          />

          <Table
            data={orders}
            columns={columns}
            title="All Purchase Orders"
          />
        </div>

        {/* Create PO Modal */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={handleCloseCreateModal}
          title="Create Purchase Order"
        >
          <form onSubmit={handleSubmitCreate(onSubmitCreate)} className="space-y-4">
            <Select
              label="Supplier"
              {...registerCreate('supplierId', { required: 'Supplier is required' })}
              error={errorsCreate.supplierId?.message}
            >
              <option value="" className="bg-slate-900 text-white">Select supplier</option>
              {suppliers?.map(supplier => (
                <option key={supplier._id} value={supplier._id} className="bg-slate-900 text-white">
                  {supplier.name}
                </option>
              ))}
            </Select>

            <Input
              label="Expected Delivery Date"
              type="date"
              {...registerCreate('expectedDeliveryDate', { required: 'Expected delivery date is required' })}
              error={errorsCreate.expectedDeliveryDate?.message}
            />

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Items
              </label>
              {fields.map((field, index) => (
                <div key={field.id} className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_8rem_auto]">
                  <Select
                    {...registerCreate(`items.${index}.productId`, { required: 'Product is required' })}
                    className="flex-1"
                  >
                    <option value="" className="bg-slate-900 text-white">Select product</option>
                    {products?.map(product => (
                      <option key={product._id} value={product._id} className="bg-slate-900 text-white">
                        {product.name} ({product.sku})
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Enter quantity"
                    {...registerCreate(`items.${index}.quantity`, { 
                      required: 'Quantity is required',
                      min: { value: 1, message: 'Min 1' }
                    })}
                    className="w-full"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={`${symbol} 0.00`}
                    {...registerCreate(`items.${index}.unitPrice`, { 
                      required: 'Price is required',
                      min: { value: 0, message: 'Min 0' }
                    })}
                    className="w-full"
                  />
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => remove(index)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => append({ productId: '', quantity: 1, unitPrice: 0 })}
              >
                Add Item
              </Button>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCloseCreateModal}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={createMutation.isPending}
              >
                Create PO
              </Button>
            </div>

            {createMutation.isError && (
              <Error message="Failed to create purchase order. Please try again." />
            )}
          </form>
        </Modal>

        {/* Receive PO Modal */}
        <Modal
          isOpen={isReceiveModalOpen}
          onClose={handleCloseReceiveModal}
          title="Receive Purchase Order"
        >
          {selectedPO && (
            <form onSubmit={handleSubmitReceive(onSubmitReceive)} className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-slate-300 space-y-2">
                <p className="text-sm"><span className="font-semibold text-white">PO Number:</span> {selectedPO.orderNumber}</p>
                <p className="text-sm"><span className="font-semibold text-white">Supplier:</span> {selectedPO.supplierId.name}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Received Items
                </label>
                {selectedPO.items.map((item, index) => (
                  <div key={index} className="mb-4 rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="font-semibold text-white mb-2">{item.productId.name}</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Input
                        label="Quantity Received"
                        type="number"
                        min="0"
                        max={item.quantity}
                        {...registerReceive(`receivedItems.${index}.receivedQuantity`, {
                          required: 'Quantity is required',
                          max: { value: item.quantity, message: `Max ${item.quantity}` }
                        })}
                      />
                      <Input
                        label="Purchase Price"
                        type="number"
                        step="0.01"
                        min="0"
                        {...registerReceive(`receivedItems.${index}.purchasePrice`)}
                      />
                      <Input
                        label="Supply Date"
                        type="date"
                        {...registerReceive(`receivedItems.${index}.supplyDate`)}
                      />
                      <Input
                        label="Expiry Date"
                        type="date"
                        {...registerReceive(`receivedItems.${index}.expiryDate`, { required: 'Expiry date is required' })}
                      />
                      <Input
                        label="Selling Price"
                        type="number"
                        step="0.01"
                        min="0"
                        {...registerReceive(`receivedItems.${index}.sellingPrice`, { required: 'Selling price is required' })}
                      />
                    </div>
                    <input
                      type="hidden"
                      {...registerReceive(`receivedItems.${index}.productId`)}
                      value={item.productId._id}
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCloseReceiveModal}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={receiveMutation.isPending}
                >
                  Receive Items
                </Button>
              </div>

              {receiveMutation.isError && (
                <Error message="Failed to receive purchase order. Please try again." />
              )}
            </form>
          )}
        </Modal>
      </div>
      <AdminMobileBottomNav active="inventory" />
    </AdminLayout>
  );
}


