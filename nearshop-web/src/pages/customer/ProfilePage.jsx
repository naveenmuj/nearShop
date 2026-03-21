import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { getBalance, getStreak, getBadges } from '../../api/loyalty'
import client from '../../api/client'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, logout, switchRole } = useAuthStore()
  const [balance, setBalance] = useState(0)
  const [streak, setStreak] = useState(null)
  const [badges, setBadges] = useState([])
  const [loading, setLoading] = useState(true)
  const [switchingRole, setSwitchingRole] = useState(false)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [balRes, streakRes, badgesRes] = await Promise.all([
          getBalance(),
          getStreak(),
          getBadges(),
        ])
        setBalance(balRes.data.balance || balRes.data.coins || 0)
        setStreak(streakRes.data)
        setBadges(badgesRes.data.items || badgesRes.data || [])
      } catch {}
      finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const handleSwitchRole = async () => {
    setSwitchingRole(true)
    try {
      const newRole = user?.active_role === 'business' ? 'customer' : 'business'
      await client.post('/auth/switch-role', { role: newRole })
      switchRole(newRole)
      if (newRole === 'business') {
        navigate('/biz/dashboard')
      } else {
        navigate('/app/home')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to switch role')
    } finally {
      setSwitchingRole(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/auth/login')
  }

  const stats = {
    orders: 0,
    coins: balance,
    reviews: badges.length,
  }

  const menuItems = [
    { icon: '📦', label: 'My Orders', action: () => navigate('/app/orders') },
    { icon: '❤️', label: 'Wishlist', action: () => navigate('/app/wishlist') },
    { icon: '🪙', label: 'Wallet & Coins', action: () => navigate('/app/wallet') },
    { icon: '📍', label: 'Saved Addresses', action: () => navigate('/app/addresses') },
    { icon: '⚙️', label: 'Settings', action: () => navigate('/app/settings') },
  ]

  return (
    <div className="bg-gray-50 min-h-screen pb-8">
      {/* Hero header */}
      <div className="bg-brand-purple pt-12 pb-16 px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-white text-3xl font-bold mx-auto border-2 border-white/40">
          {user?.name?.[0]?.toUpperCase() || '?'}
        </div>
        <h1 className="text-xl font-bold text-white mt-3">{user?.name || 'User'}</h1>
        <p className="text-white/70 text-sm mt-1">{user?.phone || user?.email || ''}</p>

        {/* Stats row */}
        {!loading && (
          <div className="flex justify-center gap-8 mt-4">
            {[
              { label: 'Orders', value: stats.orders },
              { label: 'Coins', value: stats.coins },
              { label: 'Badges', value: stats.reviews },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-xl font-bold text-white">{s.value || 0}</div>
                <div className="text-white/60 text-xs">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="mt-4 flex justify-center">
            <LoadingSpinner size="sm" />
          </div>
        )}
      </div>

      {/* Menu card */}
      <div className="mx-4 -mt-4 bg-white rounded-2xl shadow-card divide-y divide-gray-50">
        {menuItems.map(item => (
          <button key={item.label} onClick={item.action}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-gray-50 transition-colors text-left first:rounded-t-2xl last:rounded-b-2xl">
            <span className="text-xl">{item.icon}</span>
            <span className="flex-1 text-sm font-medium text-gray-700">{item.label}</span>
            <span className="text-gray-300">›</span>
          </button>
        ))}
      </div>

      {/* Switch role button */}
      <button
        onClick={handleSwitchRole}
        disabled={switchingRole}
        className="mx-4 mt-4 w-full h-12 border-2 border-brand-amber text-brand-amber rounded-xl font-semibold text-sm hover:bg-brand-amber-light transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        🏪 {switchingRole ? 'Switching...' : user?.active_role === 'business' ? 'Switch to Customer Mode' : 'Switch to Business Mode'}
      </button>

      {/* Logout */}
      <button onClick={handleLogout} className="mx-4 mt-3 w-full h-12 text-brand-red text-sm font-medium hover:bg-brand-red-light rounded-xl transition-colors">
        Sign Out
      </button>
    </div>
  )
}
