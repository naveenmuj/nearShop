import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { getBalance, getStreak, getBadges } from '../../api/loyalty'
import client from '../../api/client'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { ShoppingBag, Heart, Wallet, MessageSquare, Settings, Repeat, LogOut, ChevronRight, Coins, Award, Trash2 } from 'lucide-react'

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
        const [balRes, streakRes, badgesRes] = await Promise.all([getBalance(), getStreak(), getBadges()])
        setBalance(balRes.data.balance || balRes.data.coins || 0)
        setStreak(streakRes.data)
        setBadges(badgesRes.data.items || badgesRes.data || [])
      } catch {} finally { setLoading(false) }
    }
    fetchStats()
  }, [])

  const hasBusiness = Array.isArray(user?.roles) && user.roles.includes('business')

  const handleSwitchRole = async () => {
    if (!hasBusiness) {
      // Not registered as business yet → go to business registration
      navigate('/auth/onboard/business')
      return
    }
    setSwitchingRole(true)
    try {
      const newRole = user?.active_role === 'business' ? 'customer' : 'business'
      await client.post('/auth/switch-role', { role: newRole })
      switchRole(newRole)
      navigate(newRole === 'business' ? '/biz/dashboard' : '/app/home')
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to switch role') } finally { setSwitchingRole(false) }
  }

  const handleLogout = () => { logout(); navigate('/auth/login') }

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [delCustomer, setDelCustomer] = useState(true)
  const [delBusiness, setDelBusiness] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const hasBizRole = Array.isArray(user?.roles) && user.roles.includes('business')

  const handleDeleteAccount = async () => {
    setDeleting(true)
    try {
      await client.delete('/auth/delete-account', { data: { delete_customer: delCustomer, delete_business: delBusiness } })
      if (delCustomer && delBusiness) {
        toast.success('Account permanently deleted')
        logout()
        navigate('/auth/login')
      } else if (delBusiness) {
        toast.success('Business data deleted')
        setShowDeleteModal(false)
        // Refresh user
        try { const { data } = await client.get('/auth/me'); useAuthStore.setState({ user: data }) } catch {}
      } else {
        toast.success('Account deleted')
        logout()
        navigate('/auth/login')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete account')
    } finally { setDeleting(false) }
  }

  const menuSections = [
    {
      title: 'My Account',
      items: [
        { icon: ShoppingBag, label: 'My Orders', to: '/app/orders' },
        { icon: MessageSquare, label: 'Messages', to: '/app/messages' },
        { icon: Heart, label: 'Wishlist', to: '/app/wishlist' },
        { icon: Wallet, label: 'Wallet & Coins', to: '/app/wallet', badge: balance > 0 ? `${balance} coins` : null },
        { icon: MessageSquare, label: 'My Haggles', to: '/app/haggle' },
      ],
    },
  ]

  return (
    <div className="max-w-3xl mx-auto">
      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 lg:p-8 mb-6">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-purple to-brand-purple-dark flex items-center justify-center text-white text-3xl font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">{user?.name || 'User'}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{user?.phone || user?.email || ''}</p>
            {user?.created_at && (
              <p className="text-xs text-gray-400 mt-1">Member since {user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : ''}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
            {[
              { icon: ShoppingBag, label: 'Orders', value: 0, color: 'text-brand-purple' },
              { icon: Coins, label: 'Coins', value: balance, color: 'text-brand-amber' },
              { icon: Award, label: 'Badges', value: badges.length, color: 'text-brand-green' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
                <p className="text-xl font-extrabold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-400 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Menu sections */}
      {menuSections.map(section => (
        <div key={section.title} className="mb-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">{section.title}</h2>
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            {section.items.map(item => (
              <button key={item.label} onClick={() => navigate(item.to)}
                className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition text-left">
                <div className="w-9 h-9 rounded-lg bg-brand-purple-light flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-4 h-4 text-brand-purple" />
                </div>
                <span className="flex-1 text-sm font-medium text-gray-800">{item.label}</span>
                {item.badge && <span className="text-xs text-brand-amber font-semibold bg-brand-amber-light px-2 py-0.5 rounded-full">{item.badge}</span>}
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Business + Logout */}
      <div className="mb-6">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
          {hasBusiness ? 'Business' : 'Grow with NearShop'}
        </h2>
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          <button onClick={handleSwitchRole} disabled={switchingRole}
            className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-gray-50 transition text-left">
            <div className="w-9 h-9 rounded-lg bg-brand-green-light flex items-center justify-center">
              {hasBusiness ? <Repeat className="w-4 h-4 text-brand-green" /> : <span className="text-base">🚀</span>}
            </div>
            <span className="flex-1 text-sm font-medium text-gray-800">
              {switchingRole ? 'Switching...' : hasBusiness ? 'Switch to Business Mode' : 'Register Your Business'}
            </span>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
        <button onClick={handleLogout} className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-red-50 transition text-left">
          <div className="w-9 h-9 rounded-lg bg-brand-red-light flex items-center justify-center"><LogOut className="w-4 h-4 text-brand-red" /></div>
          <span className="flex-1 text-sm font-medium text-brand-red">Sign Out</span>
        </button>
        <button onClick={() => setShowDeleteModal(true)} className="w-full flex items-center gap-4 px-4 py-3.5 hover:bg-red-50 transition text-left">
          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center"><Trash2 className="w-4 h-4 text-red-600" /></div>
          <span className="flex-1 text-sm font-medium text-red-600">Delete Account</span>
        </button>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Delete Account</h2>
            <p className="text-sm text-gray-500 mb-5">
              Choose what to delete. Deleting everything will permanently remove your account and Firebase login.
            </p>

            <div className="space-y-3 mb-6">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition">
                <input type="checkbox" checked={delCustomer} onChange={e => setDelCustomer(e.target.checked)}
                  className="w-4 h-4 accent-red-500 rounded" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">Customer Data</p>
                  <p className="text-xs text-gray-400">Orders, wishlist, reviews, coins, achievements</p>
                </div>
              </label>

              {hasBizRole && (
                <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50 transition">
                  <input type="checkbox" checked={delBusiness} onChange={e => setDelBusiness(e.target.checked)}
                    className="w-4 h-4 accent-red-500 rounded" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Business Data</p>
                    <p className="text-xs text-gray-400">Shops, products, deals, billing, inventory</p>
                  </div>
                </label>
              )}

              {delCustomer && delBusiness && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs font-semibold text-red-700">
                    This will permanently delete your user account and Firebase login. You cannot undo this.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handleDeleteAccount} disabled={deleting || (!delCustomer && !delBusiness)}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-sm font-bold text-white hover:bg-red-700 transition disabled:opacity-40">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-gray-300 mt-6">NearShop v1.0.0</p>
    </div>
  )
}
