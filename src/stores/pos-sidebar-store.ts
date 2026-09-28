import { create } from 'zustand';

interface POSSidebarState {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
}

export const usePOSSidebarStore = create<POSSidebarState>((set) => ({
  isOpen: false,
  setIsOpen: (isOpen) => set({ isOpen }),
  openSidebar: () => set({ isOpen: true }),
  closeSidebar: () => set({ isOpen: false }),
  toggleSidebar: () => set((state) => ({ isOpen: !state.isOpen })),
}));
