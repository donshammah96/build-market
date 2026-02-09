import { CartStoreActionsType, CartStoreStateType } from "@build/types";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Extended interface to include all methods used by shop pages
interface ExtendedCartStoreState extends CartStoreStateType {
  items: CartStoreStateType["cart"]; // Alias for cart
}

interface ExtendedCartStoreActions extends CartStoreActionsType {
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  getTotal: () => number;
}

const useCartStore = create<
  ExtendedCartStoreState & ExtendedCartStoreActions
>()(
  persist(
    (set, get) => ({
      cart: [],
      items: [], // Will be synced with cart
      hasHydrated: false,
      addToCart: (product) =>
        set((state) => {
          const existingIndex = state.cart.findIndex(
            (p) =>
              p.id === product.id &&
              p.selectedSize === product.selectedSize &&
              p.selectedColor === product.selectedColor,
          );

          if (existingIndex !== -1) {
            const updatedCart = [...state.cart];
            updatedCart[existingIndex]!.quantity += product.quantity || 1;
            return { cart: updatedCart, items: updatedCart };
          }

          const newCart = [
            ...state.cart,
            {
              ...product,
              quantity: product.quantity || 1,
              selectedSize: product.selectedSize,
              selectedColor: product.selectedColor,
            },
          ];
          return { cart: newCart, items: newCart };
        }),
      removeFromCart: (product) =>
        set((state) => {
          const newCart = state.cart.filter(
            (p) =>
              !(
                p.id === product.id &&
                p.selectedSize === product.selectedSize &&
                p.selectedColor === product.selectedColor
              ),
          );
          return { cart: newCart, items: newCart };
        }),
      // Alias removeItem that works by ID only
      removeItem: (id: string) =>
        set((state) => {
          const newCart = state.cart.filter((p) => p.id !== id);
          return { cart: newCart, items: newCart };
        }),
      updateQuantity: (id: string, quantity: number) =>
        set((state) => {
          if (quantity <= 0) {
            const newCart = state.cart.filter((p) => p.id !== id);
            return { cart: newCart, items: newCart };
          }
          const newCart = state.cart.map((p) =>
            p.id === id ? { ...p, quantity } : p,
          );
          return { cart: newCart, items: newCart };
        }),
      getTotal: () => {
        const state = get();
        return state.cart.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0,
        );
      },
      clearCart: () => set({ cart: [], items: [] }),
    }),
    {
      name: "cart",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasHydrated = true;
          // Ensure items is synced with cart on hydration
          state.items = state.cart;
        }
      },
    },
  ),
);

// Export both as default and named export for flexibility
export { useCartStore };
export default useCartStore;
