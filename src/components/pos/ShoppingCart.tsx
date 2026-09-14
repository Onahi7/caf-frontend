import { ShoppingBag, Plus, Minus, Trash2, ArrowRight } from 'lucide-react';
import { useCartStore, itemKey } from '../../stores/cart-store';
import { useCurrency } from '../../hooks/useCurrency';
import { Button } from '../ui/Button';

interface ShoppingCartProps {
  onCheckout: () => void;
}

export const ShoppingCart = ({ onCheckout }: ShoppingCartProps) => {
  const { items, subtotal, discount, total, updateQuantity, removeItem } = useCartStore();
  const { format } = useCurrency();

  const handleQuantityChange = (productId: string, packSize: typeof items[number]['packSize'], newQuantity: string) => {
    const quantity = parseInt(newQuantity, 10);
    if (!isNaN(quantity) && quantity > 0) {
      updateQuantity(productId, quantity, packSize);
    }
  };

  const handleQuantityIncrement = (productId: string, packSize: typeof items[number]['packSize'], currentQuantity: number) => {
    updateQuantity(productId, currentQuantity + 1, packSize);
  };

  const handleQuantityDecrement = (productId: string, packSize: typeof items[number]['packSize'], currentQuantity: number) => {
    if (currentQuantity > 1) {
      updateQuantity(productId, currentQuantity - 1, packSize);
    }
  };

  const hasItems = items.length > 0;

  return (
    <div className="flex flex-col h-full bg-slate-900/60 backdrop-blur-md">
      {/* Cart Header */}
      <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold text-slate-100 tracking-tight">Current Order</h2>
        </div>
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-800 text-slate-300 border border-white/10 tabular-nums">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
            <div className="w-16 h-16 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-500 mb-3 shadow-inner">
              <ShoppingBag className="w-7 h-7 stroke-[1.5]" />
            </div>
            <p className="text-sm font-semibold text-slate-300">Cart is empty</p>
            <p className="text-xs text-slate-500 mt-1 max-w-[200px]">
              Scan a barcode or tap products from the catalog to start an order.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={itemKey(item.productId, item.packSize)}
              className="bg-slate-900/90 hover:bg-slate-800/90 rounded-2xl p-3.5 border border-white/[0.08] hover:border-white/15 transition-all duration-150 shadow-xs group"
            >
              {/* Item Header */}
              <div className="flex items-start justify-between gap-2 mb-2.5">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-xs text-slate-100 leading-snug break-words">
                    {item.productName}
                  </h3>
                  <div className="flex items-center flex-wrap gap-1.5 mt-1">
                    {item.brand && item.brand.trim().toLowerCase() !== 'unknown' && (
                      <span className="text-[11px] text-emerald-400 font-medium">
                        {item.brand}
                      </span>
                    )}
                    {item.packSize && (
                      <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-md text-[10px] font-semibold">
                        {item.packSize.name}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-500 font-mono">
                      #{item.sku}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => removeItem(item.productId, item.packSize)}
                  className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg p-1.5 transition-colors shrink-0"
                  title="Remove item"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Quantity Controls and Price */}
              <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                {/* Stepper */}
                <div className="flex items-center space-x-1 bg-slate-950/80 p-0.5 rounded-xl border border-white/[0.06]">
                  <button
                    onClick={() => handleQuantityDecrement(item.productId, item.packSize, item.quantity)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors active:scale-95"
                    disabled={item.quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleQuantityChange(item.productId, item.packSize, e.target.value)}
                    className="w-10 px-1 py-0.5 text-center bg-transparent text-slate-100 text-xs font-semibold focus:outline-none tabular-nums"
                  />

                  <button
                    onClick={() => handleQuantityIncrement(item.productId, item.packSize, item.quantity)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Price */}
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 tabular-nums">
                    {format(item.unitPrice)} each
                  </p>
                  <p className="text-sm font-bold text-emerald-400 tabular-nums font-mono">
                    {format(item.subtotal)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cart Summary */}
      {hasItems && (
        <div className="border-t border-white/[0.08] p-4 bg-slate-900/90 backdrop-blur-xl shadow-xl space-y-3 pb-safe-bottom">
          {/* Totals Breakdown */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span className="text-slate-200 font-medium tabular-nums">{format(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-rose-400">
                <span>Discount</span>
                <span className="font-semibold tabular-nums">-{format(discount)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-white/[0.08]">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">Total Due</span>
              <span className="text-xl font-black text-emerald-400 tabular-nums font-mono tracking-tight">
                {format(total)}
              </span>
            </div>
          </div>

          {/* Checkout CTA */}
          <Button
            onClick={onCheckout}
            variant="primary"
            size="lg"
            className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl shadow-lg shadow-emerald-500/20"
          >
            <span>Proceed to Checkout</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
