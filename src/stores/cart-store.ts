import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PackSize {
  code?: string;
  name: string;           // "Box", "Strip", "Tablet"
  unit: string;           // "box", "strip", "tablet"
  quantityPerPack: number; // 100, 10, 1
  sellingPrice: number;   // Price per pack
  barcode?: string;
}

export interface CartItem {
  productId: string;
  productName: string;
  brand?: string;
  sku: string;
  barcode: string;
  quantity: number;       // Quantity in selected pack units
  unitPrice: number;      // Price per selected pack unit
  subtotal: number;
  requiresPrescription: boolean;

  // Pack size info (for unit conversion)
  packSize?: PackSize;    // Selected pack size (undefined = base unit)
  baseUnit: string;       // Base unit name: "tablet", "capsule"
  quantityInBaseUnits: number; // Actual quantity deducted from stock
}

export interface CartCustomer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  loyaltyPoints?: number;
  creditBalance?: number;
  creditLimit?: number;
}

interface CartState {
  items: CartItem[];
  discount: number;
  manualDiscount: number;
  promotionId?: string;
  prescriptionUrl?: string;
  customer: CartCustomer | null;

  // Computed values
  subtotal: number;
  total: number;

  // Actions
  addItem: (item: Omit<CartItem, 'subtotal'>) => void;
  removeItem: (productId: string, packSize?: PackSize | string) => void;
  updateQuantity: (productId: string, quantity: number, packSize?: PackSize | string) => void;
  updateItemPrice: (productId: string, unitPrice: number, packSize?: PackSize | string) => void;
  setDiscount: (discount: number) => void;
  setPromotion: (promotionId: string | undefined, discount: number, manualDiscount?: number) => void;
  setPrescription: (url: string) => void;
  setCustomer: (customer: CartCustomer | null) => void;
  clearCustomer: () => void;
  clearCart: () => void;
  restoreCart: (snapshot: {
    items: CartItem[];
    discount: number;
    manualDiscount?: number;
    promotionId?: string;
    prescriptionUrl?: string;
    customer?: CartCustomer | null;
  }) => void;
  calculateTotals: () => void;
}

/**
 * Generate a unique key for cart items (productId + packSize)
 * This allows selling the same product in different pack sizes
 */
export function packSizeKey(packSize?: PackSize | string): string | undefined {
  if (!packSize) return undefined;
  if (typeof packSize === 'string') return packSize;
  return (
    packSize.code ||
    packSize.barcode ||
    `${packSize.unit}:${packSize.quantityPerPack}:${packSize.name}`
  );
}

export function itemKey(productId: string, packSize?: PackSize | string): string {
  const key = packSizeKey(packSize);
  return key ? `${productId}:${key}` : productId;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      discount: 0,
      manualDiscount: 0,
      promotionId: undefined,
      prescriptionUrl: undefined,
      customer: null,
      subtotal: 0,
      total: 0,

      addItem: (item) => {
        const items = get().items;
        const key = itemKey(item.productId, item.packSize);
        const existingItem = items.find(
          (i) => itemKey(i.productId, i.packSize) === key
        );

        if (existingItem) {
          // Update quantity if same product + same pack size already in cart
          set({
            items: items.map((i) =>
              itemKey(i.productId, i.packSize) === key
                ? {
                    ...i,
                    quantity: i.quantity + item.quantity,
                    subtotal: (i.quantity + item.quantity) * i.unitPrice,
                    quantityInBaseUnits: i.quantityInBaseUnits + item.quantityInBaseUnits,
                  }
                : i
            ),
          });
        } else {
          // Add new item (different product or different pack size)
          set({
            items: [
              ...items,
              {
                ...item,
                subtotal: item.quantity * item.unitPrice,
              },
            ],
          });
        }
        get().calculateTotals();
      },

      removeItem: (productId, packSizeUnit) => {
        const key = itemKey(productId, packSizeUnit);
        set({
          items: get().items.filter(
            (item) => itemKey(item.productId, item.packSize) !== key
          ),
        });
        get().calculateTotals();
      },

      updateQuantity: (productId, quantity, packSizeUnit) => {
        if (quantity <= 0) {
          get().removeItem(productId, packSizeUnit);
          return;
        }

        const key = itemKey(productId, packSizeUnit);
        set({
          items: get().items.map((item) => {
            if (itemKey(item.productId, item.packSize) !== key) return item;

            const quantityInBaseUnits = item.packSize
              ? quantity * item.packSize.quantityPerPack
              : quantity;

            return {
              ...item,
              quantity,
              subtotal: quantity * item.unitPrice,
              quantityInBaseUnits,
            };
          }),
        });
        get().calculateTotals();
      },

      updateItemPrice: (productId, unitPrice, packSizeUnit) => {
        const key = itemKey(productId, packSizeUnit);
        set({
          items: get().items.map((item) =>
            itemKey(item.productId, item.packSize) === key
              ? {
                  ...item,
                  unitPrice,
                  subtotal: item.quantity * unitPrice,
                }
              : item
          ),
        });
        get().calculateTotals();
      },

      setDiscount: (discount) => {
        set({ discount: Math.max(0, discount), manualDiscount: Math.max(0, discount), promotionId: undefined });
        get().calculateTotals();
      },

      setPromotion: (promotionId, discount, manualDiscount = 0) => {
        set({ promotionId, discount: Math.max(0, discount), manualDiscount: Math.max(0, manualDiscount) });
        get().calculateTotals();
      },

      setPrescription: (url) => {
        set({ prescriptionUrl: url });
      },

      setCustomer: (customer) => {
        set({ customer });
      },

      clearCustomer: () => {
        set({ customer: null });
      },

      clearCart: () => {
        set({
          items: [],
          discount: 0,
          manualDiscount: 0,
          promotionId: undefined,
          prescriptionUrl: undefined,
          customer: null,
          subtotal: 0,
          total: 0,
        });
      },

      restoreCart: (snapshot) => {
        set({
          items: snapshot.items.map((i) => ({ ...i })),
          discount: snapshot.discount ?? 0,
          manualDiscount: snapshot.manualDiscount ?? 0,
          promotionId: snapshot.promotionId,
          prescriptionUrl: snapshot.prescriptionUrl,
          customer: snapshot.customer ?? null,
        });
        get().calculateTotals();
      },

      calculateTotals: () => {
        const items = get().items;
        const discount = Math.max(0, get().discount);
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const total = Math.max(0, subtotal - Math.min(discount, subtotal));

        set({ subtotal, total, discount: Math.min(discount, subtotal) });
      },
    }),
    {
      name: 'pos-cart-storage',
      partialize: (state) => ({
        items: state.items,
        discount: state.discount,
        manualDiscount: state.manualDiscount,
        promotionId: state.promotionId,
        prescriptionUrl: state.prescriptionUrl,
        customer: state.customer,
        subtotal: state.subtotal,
        total: state.total,
      }),
      onRehydrateStorage: () => (state) => {
        state?.calculateTotals();
      },
    },
  ),
);
