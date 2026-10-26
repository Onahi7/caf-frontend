import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Tag, Package, Plus, Check, AlertTriangle, X } from 'lucide-react';
import apiClient from '../../lib/api-client';
import { useDebounce } from '../../hooks/useDebounce';
import { useCurrency } from '../../hooks/useCurrency';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useCartStore } from '../../stores/cart-store';
import { useToast } from '../../hooks/useToast';

interface QuickPriceLookupModalProps {
  open: boolean;
  onClose: () => void;
  branchId: string | undefined;
}

interface LookupProduct {
  _id: string;
  name: string;
  brand?: string;
  sku: string;
  barcode?: string;
  price: number;
  stock: number;
  category?: string;
  packSizes?: { code?: string; name: string; unit?: string; sellingPrice: number; quantityPerPack: number; barcode?: string }[];
}

export const QuickPriceLookupModal = ({ open, onClose, branchId }: QuickPriceLookupModalProps) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 150);
  const inputRef = useRef<HTMLInputElement>(null);
  const { format, symbol } = useCurrency();
  const addItem = useCartStore((s) => s.addItem);
  const { showSuccess } = useToast();

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    } else {
      setSearch('');
    }
  }, [open]);

  const { data: products, isLoading } = useQuery({
    queryKey: ['quick-price-lookup', debouncedSearch, branchId],
    queryFn: async () => {
      if (!debouncedSearch.trim()) return [];
      const params = new URLSearchParams();
      params.set('search', debouncedSearch.trim());
      if (branchId) params.set('branchId', branchId);
      params.set('limit', '20');
      const res = await apiClient.get<LookupProduct[] | { data?: LookupProduct[] }>(`/products?${params}`);
      const body = res.data;
      return Array.isArray(body) ? body : (body?.data ?? []);
    },
    enabled: open && debouncedSearch.trim().length > 0,
  });

  const handleAddToCart = (p: LookupProduct, packSize?: { code?: string; name: string; unit?: string; sellingPrice: number; quantityPerPack?: number; barcode?: string }) => {
    addItem({
      productId: p._id,
      productName: packSize ? `${p.name} (${packSize.name})` : p.name,
      brand: p.brand,
      sku: p.sku,
      barcode: packSize?.barcode || p.barcode || '',
      quantity: 1,
      unitPrice: packSize ? packSize.sellingPrice : p.price,
      requiresPrescription: false,
      packSize: packSize
        ? {
            code: packSize.code,
            name: packSize.name,
            unit: packSize.unit || packSize.name.toLowerCase(),
            quantityPerPack: packSize.quantityPerPack || 1,
            sellingPrice: packSize.sellingPrice,
            barcode: packSize.barcode,
          }
        : undefined,
      baseUnit: 'unit',
      quantityInBaseUnits: packSize?.quantityPerPack || 1,
    });
    showSuccess(`Added "${p.name}" to cart`);
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Quick Price & Stock Lookup (F3)" size="lg">
      <div className="space-y-4">
        {/* Search input with autofocus */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type drug name, brand, SKU or barcode to check price..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-white/10 bg-slate-950/70 text-white placeholder-slate-500 text-sm focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Results section */}
        <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 scrollbar-none">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
              Searching product catalog & current branch stock…
            </div>
          ) : !debouncedSearch.trim() ? (
            <div className="py-8 text-center space-y-1 text-slate-500 text-xs">
              <Tag className="w-6 h-6 mx-auto opacity-40 mb-1" />
              <p>Type a product name or scan a barcode to check prices instantly.</p>
              <p className="text-[11px] text-slate-600">Your current customer cart remains untouched.</p>
            </div>
          ) : products && products.length > 0 ? (
            products.map((p) => {
              const isOutOfStock = p.stock <= 0;
              const isLowStock = p.stock > 0 && p.stock <= 5;

              return (
                <div
                  key={p._id}
                  className="p-3 rounded-xl border border-white/5 bg-slate-900/60 hover:bg-slate-900/90 transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{p.name}</span>
                      {p.brand && (
                        <span className="text-xs text-slate-400 font-medium">({p.brand})</span>
                      )}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                          isOutOfStock
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : isLowStock
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {isOutOfStock ? 'Out of stock' : `${p.stock} in stock`}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-400 font-mono">
                      <span>SKU: {p.sku}</span>
                      {p.barcode && <span>Barcode: {p.barcode}</span>}
                    </div>

                    {/* Pack sizes if available */}
                    {p.packSizes && p.packSizes.length > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        {p.packSizes.map((pack) => (
                          <button
                            key={pack.code || pack.name}
                            type="button"
                            onClick={() => handleAddToCart(p, pack)}
                            className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-emerald-600/30 text-slate-300 hover:text-emerald-300 border border-white/5 transition-colors cursor-pointer flex items-center gap-1"
                            title="Add pack to cart"
                          >
                            <span>{pack.name}:</span>
                            <span className="font-bold text-emerald-400">{format(pack.sellingPrice)}</span>
                            <Plus className="w-2.5 h-2.5 opacity-60" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="font-mono text-base font-bold text-emerald-400">
                        {format(p.price)}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wide">
                        Unit Price
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="primary"
                      disabled={isOutOfStock}
                      onClick={() => handleAddToCart(p)}
                      title="Add 1 unit to cart"
                      className="cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              No products found matching "{search}".
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-white/10 text-[10px] text-slate-300">Esc</kbd> to close
          </span>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
