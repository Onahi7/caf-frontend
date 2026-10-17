import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, CartCustomer } from './cart-store';

export interface HeldSale {
  id: string;                    // UUID
  label: string;                 // "Sale 1", "Customer X", or custom
  items: CartItem[];
  discount: number;
  manualDiscount?: number;
  promotionId?: string;
  prescriptionUrl?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customer?: CartCustomer | null;
  notes?: string;
  heldAt: string;                // ISO timestamp
  heldBy: string;                // userId
  branchId: string;
  subtotal: number;
  total: number;
}

interface HeldSalesState {
  heldSales: HeldSale[];
  holdSale: (sale: Omit<HeldSale, 'id' | 'heldAt'>) => HeldSale;
  recallSale: (id: string) => HeldSale | undefined;
  discardSale: (id: string) => void;
  renameSale: (id: string, label: string) => void;
  clearAll: () => void;
}

function uid(): string {
  return `held_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useHeldSalesStore = create<HeldSalesState>()(
  persist(
    (set, get) => ({
      heldSales: [],

      holdSale: (sale) => {
        const newSale: HeldSale = {
          ...sale,
          id: uid(),
          heldAt: new Date().toISOString(),
        };
        set({ heldSales: [newSale, ...get().heldSales] });
        return newSale;
      },

      recallSale: (id) => {
        const sale = get().heldSales.find((s) => s.id === id);
        if (sale) {
          set({ heldSales: get().heldSales.filter((s) => s.id !== id) });
        }
        return sale;
      },

      discardSale: (id) => {
        set({ heldSales: get().heldSales.filter((s) => s.id !== id) });
      },

      renameSale: (id, label) => {
        set({
          heldSales: get().heldSales.map((s) =>
            s.id === id ? { ...s, label } : s,
          ),
        });
      },

      clearAll: () => {
        set({ heldSales: [] });
      },
    }),
    {
      name: 'pos-held-sales-storage',
      partialize: (state) => ({ heldSales: state.heldSales }),
    },
  ),
);
