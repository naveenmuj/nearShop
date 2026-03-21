import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      const userData = await SecureStore.getItemAsync('user_data');
      if (token && userData) {
        set({ user: JSON.parse(userData), isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  login: async (tokens, user) => {
    await SecureStore.setItemAsync('access_token', tokens.access_token);
    if (tokens.refresh_token) {
      await SecureStore.setItemAsync('refresh_token', tokens.refresh_token);
    }
    await SecureStore.setItemAsync('user_data', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user_data');
    set({ user: null, isAuthenticated: false });
  },

  updateUser: async (user) => {
    await SecureStore.setItemAsync('user_data', JSON.stringify(user));
    set({ user });
  },

  switchRole: async (newRole) => {
    const user = get().user;
    if (user) {
      const updated = { ...user, active_role: newRole };
      await SecureStore.setItemAsync('user_data', JSON.stringify(updated));
      set({ user: updated });
    }
  },
}));

export default useAuthStore;
