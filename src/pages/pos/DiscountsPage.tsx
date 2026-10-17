import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/api-client';
import { unwrapArray } from '../../lib/unwrap-response';
import { useCartStore } from '../../stores/cart-store';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import { Error } from '../../components/ui/Error';
import { queryKeys } from '../../lib/query-keys';
import { useCurrency } from '../../hooks/useCurrency';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../hooks/useToast';
import { POSLayout } from '../../components/pos/POSLayout';

interface Promotion {
  _id: string;
  name: string;
  description?: string;
  type: 'percentage' | 'fixed_amount' | 'buy_x_get_y';
  scope: 'entire_transaction' | 'specific_item' | 'category';
  value: number;
  minimumPurchase?: number;
  isActive: boolean;
}

export const DiscountsPage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const { items, subtotal, manualDiscount: storedManualDiscount, promotionId, setPromotion } = useCartStore();
  const { format } = useCurrency();
  const { showSuccess } = useToast();

  const [selectedPromotion, setSelectedPromotion] = useState<string | undefined>(promotionId);
  const [percentageDiscount, setPercentageDiscount] = useState('');
  const [fixedDiscount, setFixedDiscount] = useState(
    storedManualDiscount > 0 ? String(storedManualDiscount) : '',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const requestedManualDiscount = Math.min(
    subtotal,
    Math.max(0, Number(fixedDiscount) || 0) +
      subtotal * Math.min(100, Math.max(0, Number(percentageDiscount) || 0)) / 100,
  );
  const debouncedManualDiscount = useDebounce(requestedManualDiscount, 250);

  const { data: promotions, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.promotions.list({ isActive: true, branchId: getBranchId(selectedBranch) }),
    queryFn: async () => {
      const response = await apiClient.get('/promotions/active', {
        params: { branchId: getBranchId(selectedBranch) },
      });
      return unwrapArray<Promotion>(response.data);
    },
    enabled: !!getBranchId(selectedBranch),
  });

  const branchId = user?.role === 'super_admin'
    ? (getBranchId(selectedBranch) || user?.branchId)
    : (user?.branchId || getBranchId(selectedBranch));

  const { data: quote, isFetching: isCalculating } = useQuery({
    queryKey: ['checkout-quote', branchId, selectedPromotion, debouncedManualDiscount, items],
    queryFn: async () => {
      const payload: Record<string, unknown> = {
        branchId,
        discount: typeof debouncedManualDiscount === 'number' && debouncedManualDiscount >= 0 ? debouncedManualDiscount : 0,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          ...(item.packSize ? {
            packSize: {
              code: item.packSize.code,
              name: item.packSize.name,
              unit: item.packSize.unit,
              quantityPerPack: item.packSize.quantityPerPack,
              barcode: item.packSize.barcode,
            },
          } : {}),
          quantityInBaseUnits: item.quantityInBaseUnits,
        })),
      };
      if (selectedPromotion && selectedPromotion.trim() && selectedPromotion !== 'null') {
        payload.promotionId = selectedPromotion;
      }
      const response = await apiClient.post('/sales/quote', payload);
      return response.data as {
        subtotal: number;
        discount: number;
        manualDiscount: number;
        taxAmount: number;
        total: number;
      };
    },
    enabled: Boolean(branchId && items.length),
    retry: 1,
  });

  const totalDiscount = quote?.discount ?? 0;
  const newTotal = quote?.total ?? subtotal;
  const togglePromotion = (promoId: string) => {
    setSelectedPromotion((current) => current === promoId ? undefined : promoId);
  };

  const handleApplyDiscount = () => {
    setPromotion(selectedPromotion, totalDiscount, quote?.manualDiscount ?? 0);
    if (selectedPromotion || totalDiscount > 0) {
      showSuccess(
        'Discount applied',
        `${format(totalDiscount)} off — new total ${format(newTotal)}`,
      );
    } else {
      showSuccess('Discount cleared');
    }
    navigate('/pos');
  };

  const filteredPromotions = promotions?.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <POSLayout title="Discounts & Promotions" hideHeader>
      <div className="min-h-dvh bg-slate-950 flex flex-col pt-safe-top">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.08]">
          <button onClick={() => navigate(-1)} className="text-white flex items-center min-w-11 min-h-11 justify-center -ml-2 rounded-lg hover:bg-white/5">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-bold text-white">Discounts & Promotions</h1>
          <div className="w-6" />
        </div>

        <div className="flex-1 p-4 space-y-6 overflow-y-auto">
          <div>
            <h2 className="text-white font-semibold mb-3">Staff Discount</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-2">
                <span className="block text-sm text-slate-400">Percentage</span>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={percentageDiscount}
                    onChange={(event) => setPercentageDiscount(event.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 pr-10 text-white placeholder-slate-500 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/30 focus:outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                </div>
              </label>
              <label className="space-y-2">
                <span className="block text-sm text-slate-400">Fixed amount</span>
                <input
                  type="number"
                  min="0"
                  value={fixedDiscount}
                  onChange={(event) => setFixedDiscount(event.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/30 focus:outline-none"
                />
              </label>
            </div>
          </div>

          {/* Promotions */}
          <div>
            <h2 className="text-white font-semibold mb-3">Select a Promotion</h2>

            {/* Search */}
            <div className="relative mb-3">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search promotions..."
                className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-400/30"
              />
            </div>

            {/* Promotion List */}
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-center py-4 text-slate-400">Loading...</div>
              ) : error ? (
                <Error message="Failed to load promotions" onRetry={() => refetch()} />
              ) : filteredPromotions && filteredPromotions.length > 0 ? (
                filteredPromotions.map((promo) => (
                  <button
                    key={promo._id}
                    onClick={() => togglePromotion(promo._id)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors ${
                      selectedPromotion === promo._id
                        ? 'bg-emerald-500/10 border-emerald-500'
                        : 'bg-slate-900 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="text-left">
                      <p className="text-white font-semibold">{promo.name}</p>
                      <p className="text-slate-400 text-sm">{promo.description}</p>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        selectedPromotion === promo._id
                          ? 'border-emerald-500 bg-emerald-500'
                          : 'border-slate-500'
                      }`}
                    >
                      {selectedPromotion === promo._id && (
                        <svg className="w-4 h-4 text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-4 text-slate-400">No promotions available</div>
              )}
            </div>
          </div>
        </div>

        {/* Summary & Apply */}
        <div className="p-4 border-t border-white/[0.08] space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Subtotal</span>
              <span className="text-white">{format(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Total Discount</span>
              <span className="text-rose-400">{isCalculating ? 'Calculating…' : `-${format(totalDiscount)}`}</span>
            </div>
            {(quote?.taxAmount ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Tax</span>
                <span className="text-white">{format(quote?.taxAmount ?? 0)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/10">
              <span className="text-white">New Total</span>
              <span className="text-white">{format(newTotal)}</span>
            </div>
          </div>

          <button
            onClick={handleApplyDiscount}
            disabled={isCalculating || Boolean((selectedPromotion || debouncedManualDiscount > 0) && !quote)}
            className="w-full py-4 bg-emerald-500 text-slate-950 font-semibold rounded-xl hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {selectedPromotion || debouncedManualDiscount > 0 ? 'Apply Discount' : 'Clear Discount'}
          </button>
        </div>
      </div>
    </POSLayout>
  );
};
