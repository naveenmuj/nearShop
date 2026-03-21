import { useAuthStore } from '../store/authStore'
import api from '../api/client'

export function useAuth() {
  const store = useAuthStore()

  const sendOTP = async (phone) => {
    const { data } = await api.post('/auth/send-otp', { phone })
    return data
  }

  const verifyOTP = async (phone, code) => {
    const { data } = await api.post('/auth/verify-otp', { phone, code })
    store.login(data.user)
    return data
  }

  const completeProfile = async (profileData) => {
    const { data } = await api.post('/auth/complete-profile', profileData)
    store.updateUser(data)
    return data
  }

  const switchRole = async (role) => {
    const { data } = await api.post('/auth/switch-role', { role })
    store.switchRole(role)
    return data
  }

  return { ...store, sendOTP, verifyOTP, completeProfile, switchRole }
}
