import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CART_KEY = 'nearshop-cart';

const useCartStore = create((set, get) => ({
  items: [],
  _loaded: false,

  initialize: async () => {
    try {
      const raw = await AsyncStorage.getItem(CART_KEY);
      if (raw) set({ items: JSON.parse(raw), _loaded: true });
      else set({ _loaded: true });
    } catch {
      set({ _loaded: true });
    }
  },

  _save: () => {
    const { items } = get();
    AsyncStorage.setItem(CART_KEY, JSON.stringify(items)).catch(() => {});
  },

  addItem: (product, shop = {}) => {
    set((state) => {
      const id = product.id || product.product_id;
      const existing = state.items.find((i) => i.product_id === id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.product_id === id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            product_id: id,
            shop_id: shop.id || product.shop_id,
            shop_name: shop.name || product.shop_name || 'Shop',
            name: product.name,
            price: Number(product.price),
            compare_price: product.compare_price ? Number(product.compare_price) : null,
            image: Array.isArray(product.images) ? product.images[0] : product.image || null,
            quantity: 1,
          },
        ],
      };
    });
    get()._save();
  },

  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((i) => i.product_id !== productId),
    }));
    get()._save();
  },

  updateQuantity: (productId, qty) => {
    set((state) => ({
      items:
        qty > 0
          ? state.items.map((i) => (i.product_id === productId ? { ...i, quantity: qty } : i))
          : state.items.filter((i) => i.product_id !== productId),
    }));
    get()._save();
  },

  clearCart: () => {
    set({ items: [] });
    AsyncStorage.removeItem(CART_KEY).catch(() => {});
  },

  clearShopItems: (shopId) => {
    set((state) => ({
      items: state.items.filter((i) => i.shop_id !== shopId),
    }));
    get()._save();
  },

  getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

  getSubtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

  getShopGroups: () => {
    const groups = {};
    get().items.forEach((item) => {
      const sid = item.shop_id;
      if (!groups[sid]) {
        groups[sid] = { shop_id: sid, shop_name: item.shop_name, items: [], subtotal: 0 };
      }
      groups[sid].items.push(item);
      groups[sid].subtotal += item.price * item.quantity;
    });
    return Object.values(groups);
  },

  getItemForProduct: (productId) => get().items.find((i) => i.product_id === productId) || null,
}));

export { useCartStore };
export default useCartStore;
