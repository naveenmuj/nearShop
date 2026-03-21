import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { auth } from '../config/firebase'
import { signOut } from 'firebase/auth'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,        // Internal HS256 JWT from /auth/firebase-signin or /auth/verify-otp
      isAuthenticated: false,
      /**
       * authReady = false until onAuthStateChanged fires for the first time.
       * ProtectedRoute waits for this before deciding to redirect.
       * NOT persisted — resets to false on every page load intentionally.
       */
      authReady: false,

      /** Called after firebase-signin succeeds — stores backend user profile + JWT */
      login: (user, token = null) => set({ user, token, isAuthenticated: true, authReady: true }),

      /** Signs out from Firebase AND clears local state */
      logout: async () => {
        try {
          await signOut(auth)
        } catch {
          // ignore
        }
        set({ user: null, token: null, isAuthenticated: false, authReady: true })
      },

      /** Mark Firebase auth as resolved (called from onAuthStateChanged) */
      setAuthReady: () => set({ authReady: true }),

      /** Update user profile after settings save */
      updateUser: (user) => set({ user }),

      /** Toggle active_role after /auth/switch-role */
      switchRole: (role) =>
        set((state) => ({
          user: state.user ? { ...state.user, active_role: role } : null,
        })),
    }),
    {
      name: 'nearshop-auth',
      // authReady is NOT persisted — must re-verify Firebase on every load
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

export default useAuthStore
