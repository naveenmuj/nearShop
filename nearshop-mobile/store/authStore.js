import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { API_BASE } from '../lib/api';

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    try {
      const token = await SecureStore.getItemAsync('access_token');
      const userData = await SecureStore.getItemAsync('user_data');
      if (token && userData) {
        try {
          const user = JSON.parse(userData);
          if (user && typeof user === 'object') {
            set({ user, isAuthenticated: true, isLoading: false });
            return;
          }
        } catch (parseErr) {
          // Corrupted user data - clear it
          console.warn('Corrupted user data, clearing storage:', parseErr.message);
          await SecureStore.deleteItemAsync('user_data');
          await SecureStore.deleteItemAsync('access_token');
          await SecureStore.deleteItemAsync('refresh_token');
        }
      }
      set({ isLoading: false });
    } catch (err) {
      console.error('Auth initialization error:', err);
      set({ isLoading: false });
    }
  },

  login: async (tokens, user) => {
    if (!tokens?.access_token || typeof tokens.access_token !== 'string') {
      throw new Error('Invalid access token');
    }
    await SecureStore.setItemAsync('access_token', tokens.access_token);
    if (tokens.refresh_token && typeof tokens.refresh_token === 'string') {
      await SecureStore.setItemAsync('refresh_token', tokens.refresh_token);
    }
    const safeUser = user && typeof user === 'object' ? user : {};
    await SecureStore.setItemAsync('user_data', JSON.stringify(safeUser));
    set({ user: safeUser, isAuthenticated: true });
  },

  logout: async () => {
    // Best-effort push token cleanup for this authenticated user before local sign-out.
    try {
      const token = await SecureStore.getItemAsync('access_token');
      if (token) {
        await fetch(`${API_BASE}/api/v1/notifications/unregister-token`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (err) {
      console.warn('Push token unregister failed during logout:', err?.message || err);
    }

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
