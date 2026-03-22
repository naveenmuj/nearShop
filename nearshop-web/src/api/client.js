import axios from 'axios'
import { auth } from '../config/firebase'
import { useAuthStore } from '../store/authStore'

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_BASE_URL}/api/v1` })

/**
 * Request interceptor — attach auth token to every request.
 * Priority:
 *   1. Internal HS256 JWT stored in authStore (issued by /auth/firebase-signin)
 *      Works in dev without a Firebase service account file.
 *   2. Firebase ID token fallback (production with service account configured)
 */
api.interceptors.request.use(
  async (config) => {
    // Prefer stored internal JWT — avoids dependency on Firebase Admin SDK
    const { token } = useAuthStore.getState()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      return config
    }
    // Fallback: Firebase ID token
    const firebaseUser = auth.currentUser
    if (firebaseUser) {
      const idToken = await firebaseUser.getIdToken()
      config.headers.Authorization = `Bearer ${idToken}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

/**
 * Response interceptor — on 401, force-refresh the Firebase token once and retry.
 * If the force-refresh also fails (token revoked / user deleted), sign out.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retried) {
      originalRequest._retried = true

      const firebaseUser = auth.currentUser
      if (firebaseUser) {
        try {
          // Stored JWT may have expired — re-exchange Firebase token for a fresh NearShop JWT
          const idToken = await firebaseUser.getIdToken(/* forceRefresh= */ true)
          const { data } = await api.post('/auth/firebase-signin', { firebase_token: idToken })
          if (data?.access_token) {
            useAuthStore.setState({ token: data.access_token })
            originalRequest.headers.Authorization = `Bearer ${data.access_token}`
            return api(originalRequest)
          }
        } catch (tokenErr) {
          const isAuthError = tokenErr?.code?.startsWith('auth/')
          if (isAuthError) {
            await auth.signOut()
            useAuthStore.setState({ user: null, token: null, isAuthenticated: false, authReady: true })
            window.location.href = '/auth/login'
          }
        }
      } else {
        useAuthStore.setState({ user: null, token: null, isAuthenticated: false, authReady: true })
        window.location.href = '/auth/login'
      }
    }

    return Promise.reject(error)
  }
)

export default api
