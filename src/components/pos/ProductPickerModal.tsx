import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Package } from 'lucide-react';
import apiClient from '../../lib/api-client';
import { useDebounce } from '../../hooks/useDebounce';
import { useQuickKeysStore, MAX_QUICK_KEYS } from '../../stores/quick-keys-store';
import { useToast } from '../../hooks/useToast';
import { useCurrency } from '../../hooks/useCurrency';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface ProductPickerModalProps {
  open: boolean;
  onClose: () => void;
  branchId: string | undefined;
}

interface PickerProduct {
  _id: string;
  name: string;
  brand?: string;
  sku: string;
  price: number;
  stock: number;
  imageUrl?: string;
  packSizes?: { code?: string; name: string; sellingPrice: number; quantityPerPack: number }[];
}

export const ProductPickerModal = ({ open, onClose, branchId }: ProductPickerModalProps) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 200);
  const { showSuccess, showError } = useToast();
  const { format } = useCurrency();
  const addKey = useQuickKeysStore((s) => s.addKey);
  const keysCount = useQuickKeysStore((s) => s.keys.length);
  const isFull = keysCount >= MAX_QUICK_KEYS;

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const { data: products, isLoading } = useQuery({
    queryKey: ['quick-key-picker', debouncedSearch, branchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (branchId) params.set('branchId', branchId);
      params.set('limit', '30');
      const res = await apiClient.get<PickerProduct[]>(`/products?${params}`);
      return res.data;
    },
    enabled: open,
  });

  const handleAdd = (p: PickerProduct, packCode?: string) => {
    if (isFull) {
      showError(`Maximum ${MAX_QUICK_KEYS} quick keys allowed`);
      return;
    }
    const ok = addKey({
      productId: p._id,
      productName: p.name,
      brand: p.brand,
      sku: p.sku,
      unitPrice: packCode
        ? p.packSizes?.find((pk) => pk.code === packCode)?.sellingPrice ?? p.price
        : p.price,
      packSizeCode: packCode,
      imageUrl: p.imageUrl,
    });
    if (ok) {
      showSuccess(`Added "${p.name}" to quick keys`);
    } else {
      showError(`"${p.name}" is already in quick keys`);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={`Add Quick Key (${keysCount}/${MAX_QUICK_KEYS})`}
      size="lg"
    >
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 select-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products by name, brand, or SKU..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-slate-950/60 text-white placeholder-slate-500 text-sm focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            autoFocus
          />
        </div>

        {/* Product List */}
        <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <div className="w-6 h-6 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
              <span className="text-xs">Loading product catalogue...</span>
            </div>
          ) : !products || products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-white/[0.08] bg-slate-950/30">
              <Package className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-300">
                {debouncedSearch ? 'No products found' : 'Type a name or SKU to search'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {debouncedSearch ? 'Try a different search query' : 'Quick keys allow 1-tap checkout in POS'}
              </p>
            </div>
          ) : (
            products.map((p) => {
              const hasPacks = p.packSizes && p.packSizes.length > 0;
              return (
                <div
                  key={p._id}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/[0.06] bg-slate-950/40 hover:border-emerald-500/30 hover:bg-slate-900/60 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                      {p.brand && <span>{p.brand} •</span>}
                      <span>SKU: {p.sku}</span>
                      <span>•</span>
                      <span className={p.stock > 0 ? 'text-emerald-400 font-medium' : 'text-rose-400'}>
                        {p.stock} in stock
                      </span>
                    </div>
                    {!hasPacks && (
                      <p className="text-xs font-mono font-bold text-emerald-400 mt-1">
                        {format(p.price)}
                      </p>
                    )}
                  </div>

                  {hasPacks ? (
                    <div className="flex flex-wrap gap-1.5 shrink-0 justify-end max-w-[200px]">
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleAdd(p)}
                        disabled={isFull}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Base
                      </Button>
                      {p.packSizes!.map((pk) => (
                        <Button
                          key={pk.code ?? pk.name}
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleAdd(p, pk.code)}
                          disabled={isFull}
                          title={`+ ${pk.name} - ${format(pk.sellingPrice)}`}
                          className="text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" /> {pk.name}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => handleAdd(p)}
                      disabled={isFull}
                      className="shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};
