import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],
      shopId: null,

      addItem: (product, quantity = 1) => set((state) => {
        // Clear cart if different shop
        if (state.shopId && state.shopId !== product.shop_id) {
          return { items: [{ ...product, quantity }], shopId: product.shop_id }
        }
        const existing = state.items.find(i => i.id === product.id)
        if (existing) {
          return { items: state.items.map(i => i.id === product.id ? { ...i, quantity: i.quantity + quantity } : i) }
        }
        return { items: [...state.items, { ...product, quantity }], shopId: product.shop_id }
      }),

      removeItem: (productId) => set((state) => {
        const items = state.items.filter(i => i.id !== productId)
        return { items, shopId: items.length ? state.shopId : null }
      }),

      updateQuantity: (productId, quantity) => set((state) => ({
        items: quantity > 0
          ? state.items.map(i => i.id === productId ? { ...i, quantity } : i)
          : state.items.filter(i => i.id !== productId)
      })),

      clearCart: () => set({ items: [], shopId: null }),

      get total() { return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0) },
    }),
    { name: 'nearshop-cart' }
  )
)
