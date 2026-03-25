import { create } from 'zustand'

export const useDeliveryStore = create((set, get) => ({
  // State
  customerLocation: null,
  addresses: [],
  selectedAddressId: null,
  deliveryChecks: {}, // shop_id -> delivery_info
  loading: false,
  error: null,

  // Actions
  setCustomerLocation: (location) =>
    set({ customerLocation: location }),

  setAddresses: (addresses) =>
    set({ addresses }),

  addAddress: (address) =>
    set((state) => ({
      addresses: [...(state.addresses || []), address],
    })),

  removeAddress: (addressId) =>
    set((state) => ({
      addresses: (state.addresses || []).filter((a) => a.id !== addressId),
    })),

  selectAddress: (addressId) =>
    set({ selectedAddressId: addressId }),

  getSelectedAddress: () => {
    const state = get()
    if (!state.selectedAddressId || !state.addresses) return null
    return state.addresses.find((a) => a.id === state.selectedAddressId)
  },

  setDeliveryInfo: (shopId, info) =>
    set((state) => ({
      deliveryChecks: {
        ...state.deliveryChecks,
        [shopId]: info,
      },
    })),

  getDeliveryInfo: (shopId) => {
    return get().deliveryChecks[shopId]
  },

  clearDeliveryChecks: () =>
    set({ deliveryChecks: {} }),

  setLoading: (loading) =>
    set({ loading }),

  setError: (error) =>
    set({ error }),

  reset: () =>
    set({
      customerLocation: null,
      addresses: [],
      selectedAddressId: null,
      deliveryChecks: {},
      loading: false,
      error: null,
    }),
}))
