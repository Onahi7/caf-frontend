import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useQuickKeysStore, type QuickKeyProduct, MAX_QUICK_KEYS } from '../../stores/quick-keys-store';
import { useToast } from '../../hooks/useToast';
import apiClient from '../../lib/api-client';
import { ProductPickerModal } from './ProductPickerModal';

export interface QuickKeyProductLite {
  _id: string;
  name: string;
  brand?: string;
  sku: string;
  price: number;
  stock: number;
  imageUrl?: string;
  packSizes?: { code?: string; name: string; sellingPrice: number; quantityPerPack: number }[];
}

interface QuickKeysGridProps {
  onAdd: (key: QuickKeyProduct) => void;
  format: (n: number) => string;
  branchId: string | undefined;
  products: QuickKeyProductLite[];
}

interface ProductDoc {
  _id?: string;
  name?: string;
  brand?: string;
  sku?: string;
  price?: number;
  sellingPrice?: number;
  basePrice?: number;
  stock?: number;
  quantityAvailable?: number;
  imageUrl?: string;
  packSizes?: QuickKeyProductLite['packSizes'];
}

const PACK_KEY_SEP = '::';

export const QuickKeysGrid = ({
  onAdd,
  format,
  branchId,
  products,
}: QuickKeysGridProps) => {
  const keys = useQuickKeysStore((s) => s.keys);
  const removeKey = useQuickKeysStore((s) => s.removeKey);
  const { showError } = useToast();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manageMode, setManageMode] = useState(false);

  const productById = useMemo(() => {
    const m = new Map<string, QuickKeyProductLite>();
    for (const p of products) m.set(p._id, p);
    return m;
  }, [products]);

  // Quick keys may reference products that are no longer in the loaded
  // catalog pages. Fetch those by ID so tiles always work.
  const missingIds = useMemo(() => {
    const ids = new Set(keys.map((k) => k.productId));
    return Array.from(ids).filter((id) => !productById.has(id)).sort();
  }, [keys, productById]);

  const { data: fetchedProducts } = useQuery({
    queryKey: ['quick-key-products', branchId, missingIds.join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        missingIds.map(async (id) => {
          try {
            const response = await apiClient.get(`/products/${id}`);
            return (response.data?.data ?? response.data) as ProductDoc;
          } catch {
            return null;
          }
        }),
      );
      return results
        .filter((doc): doc is ProductDoc => !!doc)
        .map((doc): QuickKeyProductLite => ({
          _id: doc._id ?? '',
          name: doc.name ?? '',
          brand: doc.brand,
          sku: doc.sku ?? '',
          price: doc.price ?? doc.sellingPrice ?? doc.basePrice ?? 0,
          stock: doc.stock ?? doc.quantityAvailable ?? 0,
          imageUrl: doc.imageUrl,
          packSizes: doc.packSizes,
        }));
    },
    enabled: missingIds.length > 0 && !!branchId,
    staleTime: 60_000,
  });

  const resolvedById = useMemo(() => {
    const m = new Map(productById);
    for (const p of fetchedProducts ?? []) m.set(p._id, p);
    return m;
  }, [productById, fetchedProducts]);

  const handleTileClick = (key: QuickKeyProduct) => {
    const product = resolvedById.get(key.productId);
    if (!product) {
      showError(`"${key.productName}" could not be loaded. It may have been removed.`);
      return;
    }
    if (product.stock <= 0) {
      showError(`"${key.productName}" is out of stock`);
      return;
    }
    onAdd(key);
  };

  const isFull = keys.length >= MAX_QUICK_KEYS;

  if (keys.length === 0 && !manageMode) {
    return (
      <div className="mb-4">
        <button
          onClick={() => setManageMode(true)}
          className="w-full py-3 bg-slate-900 border border-dashed border-white/15 text-slate-400 rounded-xl text-sm font-medium hover:border-emerald-400/40 hover:text-emerald-400 transition-all flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Add Quick Keys (Square-style speed buttons)
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 bg-slate-900 border border-white/10 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
          Quick Keys - {keys.length}/{MAX_QUICK_KEYS}
        </h3>
        <div className="flex gap-2">
          {!isFull && (
            <button
              onClick={() => setPickerOpen(true)}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
            >
              + Add
            </button>
          )}
          <button
            onClick={() => setManageMode((m) => !m)}
            className="text-xs text-slate-400 hover:text-white font-medium"
          >
            {manageMode ? 'Done' : 'Manage'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
        {keys.map((key) => {
          const product = resolvedById.get(key.productId);
          const outOfStock = !product || product.stock <= 0;
          return (
            <div
              key={`${key.productId}${PACK_KEY_SEP}${key.packSizeCode ?? ''}`}
              className={`relative group rounded-lg border p-2 flex flex-col items-center justify-center text-center min-h-[80px] transition-all cursor-pointer ${
                outOfStock
                  ? 'border-red-500/30 bg-red-500/5 text-red-400'
                  : 'border-white/10 bg-slate-950 hover:border-emerald-500/60 hover:bg-emerald-500/10 text-white'
              }`}
              onClick={() => !manageMode && handleTileClick(key)}
              title={manageMode ? 'Manage' : `Add ${key.productName} to cart`}
            >
              {manageMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeKey(key.productId, key.packSizeCode);
                  }}
                  className="absolute -top-2 -right-2 w-10 h-10 min-h-10 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-md hover:bg-red-600"
                  title="Remove quick key"
                >
                  x
                </button>
              )}
              <p className="text-[11px] font-semibold leading-tight line-clamp-2 break-words">
                {key.productName}
              </p>
              {key.brand && (
                <p className="text-[10px] text-slate-500 truncate max-w-full">{key.brand}</p>
              )}
              <p className="text-xs text-emerald-400 font-bold mt-1">
                {format(key.unitPrice)}
              </p>
              {outOfStock && !manageMode && (
                <span className="absolute bottom-1 right-1 text-[9px] bg-red-500/30 text-red-300 px-1 rounded">
                  OOS
                </span>
              )}
            </div>
          );
        })}
        {!isFull && manageMode && (
          <button
            onClick={() => setPickerOpen(true)}
            className="rounded-lg border-2 border-dashed border-white/15 text-slate-500 hover:border-emerald-400/40 hover:text-emerald-400 text-xs font-medium flex items-center justify-center min-h-[80px]"
          >
            + Add Key
          </button>
        )}
      </div>

      <ProductPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        branchId={branchId}
      />
    </div>
  );
};
