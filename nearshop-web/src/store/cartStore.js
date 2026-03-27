import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (product, quantity = 1, rankingContext = null) => set((state) => {
        const existing = state.items.find(i => i.id === product.id)
        if (existing) {
          return {
            items: state.items.map(i =>
              i.id === product.id ? { ...i, quantity: i.quantity + quantity, ranking_context: i.ranking_context || rankingContext || product.ranking_context || null } : i
            ),
          }
        }
        return {
          items: [
            ...state.items,
            {
              ...product,
              quantity,
              shop_id: product.shop_id || product.shop?.id,
              shop_name: product.shop_name || product.shop?.name || 'Unknown Shop',
              shop_logo: product.shop_logo || product.shop?.logo_url || null,
              ranking_context: rankingContext || product.ranking_context || null,
            },
          ],
        }
      }),

      removeItem: (productId) => set((state) => ({
        items: state.items.filter(i => i.id !== productId),
      })),

      updateQuantity: (productId, quantity) => set((state) => ({
        items: quantity > 0
          ? state.items.map(i => i.id === productId ? { ...i, quantity } : i)
          : state.items.filter(i => i.id !== productId),
      })),

      clearCart: () => set({ items: [] }),

      clearShopItems: (shopId) => set((state) => ({
        items: state.items.filter(i => i.shop_id !== shopId),
      })),

      getItemCount: () => {
        return get().items.reduce((sum, i) => sum + i.quantity, 0)
      },

      getSubtotal: () => {
        return get().items.reduce((sum, i) => sum + (i.price * i.quantity), 0)
      },

      getShopGroups: () => {
        const items = get().items
        const groups = {}
        items.forEach((item) => {
          const sid = item.shop_id
          if (!groups[sid]) {
            groups[sid] = {
              shop_id: sid,
              shop_name: item.shop_name || 'Unknown Shop',
              shop_logo: item.shop_logo || null,
              items: [],
              subtotal: 0,
            }
          }
          groups[sid].items.push(item)
          groups[sid].subtotal += item.price * item.quantity
        })
        return Object.values(groups)
      },

      getItemById: (productId) => {
        return get().items.find(i => i.id === productId) || null
      },
    }),
    { name: 'nearshop-cart' }
  )
)
