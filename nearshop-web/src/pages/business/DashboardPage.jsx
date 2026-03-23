import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Tag, BookOpen, Eye, BarChart2, Settings, ChevronRight, AlertCircle, ShoppingBag, Power } from 'lucide-react'
import toast from 'react-hot-toast'
import useMyShop from '../../hooks/useMyShop'
import { useAuthStore } from '../../store/authStore'
import { getShopStats } from '../../api/analytics'
import { getShopOrders } from '../../api/orders'
import client from '../../api/client'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')
const timeAgo = (d) => {
  if (!d) return ''
  const s = Math.floor((Date.now() - new Date(d)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { shop, shopId, loading: shopLoading } = useMyShop()
  const [stats, setStats] = useState(null)
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [shopOpen, setShopOpen] = useState(shop?.is_active !== false)

  const load = useCallback(async () => {
    if (!shopId) { setLoading(false); return }
    try {
      const [statsRes, ordersRes] = await Promise.allSettled([
        getShopStats(shopId, '7d'),
        getShopOrders(shopId, { status: 'pending', per_page: 5 }),
      ])
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data)
      if (ordersRes.status === 'fulfilled') {
        const d = ordersRes.value.data
        setPending(Array.isArray(d) ? d : d?.items ?? [])
      }
    } catch {} finally { setLoading(false) }
  }, [shopId])

  useEffect(() => { load() }, [load])
  useEffect(() => { setShopOpen(shop?.is_active !== false) }, [shop])

  const handleToggleShop = async () => {
    setToggling(true)
    try {
      const res = await client.post(`/shops/${shopId}/toggle-status`)
      setShopOpen(res.data.is_active)
      toast.success(res.data.message)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to toggle')
    } finally { setToggling(false) }
  }

  if (shopLoading || loading) {
    return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>
  }

  if (!shopId) {
    return (
      <div className="px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center border border-gray-100">
          <div className="text-5xl mb-3">🏪</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Set up your shop</h2>
          <p className="text-sm text-gray-500 mb-5">Create your shop to start listing products and accepting orders</p>
          <button onClick={() => navigate('/biz/settings')} className="bg-[#1D9E75] text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#178a65] transition-colors">
            Create My Shop
          </button>
        </div>
      </div>
    )
  }

  const statCards = [
    { label: 'Views', value: stats?.total_views ?? 0, icon: '👁️' },
    { label: 'Orders', value: stats?.total_orders ?? 0, icon: '🛍️' },
    { label: 'Revenue', value: formatPrice(stats?.total_revenue ?? 0), icon: '💰' },
    { label: 'Visitors', value: stats?.unique_visitors ?? 0, icon: '👥' },
  ]

  const quickActions = [
    { icon: Camera, label: 'Add Product', color: '#7F77DD', bg: '#EEEDFE', to: '/biz/catalog/new' },
    { icon: Tag, label: 'Create Deal', color: '#EF9F27', bg: '#FAEEDA', to: '/biz/deals/new' },
    { icon: BookOpen, label: 'Post Story', color: '#3B8BD4', bg: '#E6F1FB', to: '/biz/stories/new' },
    { icon: Eye, label: 'View as Customer', color: '#1D9E75', bg: '#E1F5EE', to: `/app/shop/${shopId}` },
    { icon: BarChart2, label: 'Analytics', color: '#D4537E', bg: '#FCE4EC', to: '/biz/analytics' },
    { icon: Settings, label: 'Settings', color: '#6B7280', bg: '#F3F4F6', to: '/biz/settings' },
  ]

  return (
    <div className="pb-4">
      {/* Shop header with open/close toggle */}
      <div className={`px-5 py-5 text-white transition-colors ${shopOpen ? 'bg-gradient-to-r from-[#1D9E75] to-[#2DB88A]' : 'bg-gradient-to-r from-gray-600 to-gray-500'}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm opacity-80">Welcome back,</p>
            <h1 className="text-xl font-bold mt-0.5">{user?.name || 'Shop Owner'}</h1>
          </div>
          <button onClick={handleToggleShop} disabled={toggling}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              shopOpen ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500/30 hover:bg-red-500/40'
            }`}>
            <Power className="w-3.5 h-3.5" />
            {toggling ? '...' : shopOpen ? 'Open' : 'Closed'}
          </button>
        </div>
        <div className="flex items-center gap-3 mt-2 text-xs opacity-80">
          <span>{shop?.total_products ?? 0} products</span>
          <span>·</span>
          <span>{shop?.total_reviews ?? 0} reviews</span>
          {shop?.avg_rating > 0 && <><span>·</span><span>⭐ {Number(shop.avg_rating).toFixed(1)}</span></>}
        </div>
      </div>

      {/* Stat cards */}
      <div className="px-4 -mt-3">
        <div className="grid grid-cols-4 gap-2">
          {statCards.map(s => (
            <div key={s.label} className="bg-white rounded-xl p-3 shadow-sm border border-gray-50 text-center">
              <span className="text-lg">{s.icon}</span>
              <p className="text-base font-extrabold text-gray-900 mt-1">{s.value}</p>
              <p className="text-[10px] font-medium text-gray-400 uppercase">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pending orders alert */}
      {pending.length > 0 && (
        <div className="px-4 mt-4">
          <button onClick={() => navigate('/biz/orders')} className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-3 hover:bg-amber-100 transition-colors">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-amber-800">{pending.length} order{pending.length > 1 ? 's' : ''} waiting</p>
              <p className="text-xs text-amber-600">Tap to accept or reject</p>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      )}

      {/* Quick actions grid */}
      <div className="px-4 mt-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">Quick Actions</p>
        <div className="grid grid-cols-3 gap-2.5">
          {quickActions.map(a => (
            <button key={a.label} onClick={() => navigate(a.to)}
              className="bg-white rounded-xl p-3 border border-gray-50 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-center">
              <div className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center mb-2" style={{ backgroundColor: a.bg }}>
                <a.icon className="w-5 h-5" style={{ color: a.color }} />
              </div>
              <p className="text-xs font-semibold text-gray-700">{a.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* AI Insight */}
      <div className="px-4 mt-4">
        <div className="bg-gradient-to-r from-[#7F77DD]/10 to-[#3B8BD4]/10 rounded-xl p-4 border border-[#7F77DD]/10">
          <div className="flex items-start gap-2.5">
            <span className="text-lg">✨</span>
            <div>
              <p className="text-sm font-bold text-gray-800">AI Insight</p>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                {stats?.total_orders > 0
                  ? `You had ${stats.total_orders} orders and ${formatPrice(stats.total_revenue)} revenue this week. ${stats.total_views > 50 ? 'Great visibility!' : 'Share your shop to get more views.'}`
                  : 'Add products and share your shop link to attract your first customers!'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent pending orders */}
      {pending.length > 0 && (
        <div className="px-4 mt-4">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Recent Orders</p>
            <button onClick={() => navigate('/biz/orders')} className="text-xs font-semibold text-[#1D9E75]">View all</button>
          </div>
          <div className="space-y-2">
            {pending.slice(0, 3).map(order => (
              <button key={order.id} onClick={() => navigate('/biz/orders')}
                className="w-full bg-white rounded-xl p-3 border border-gray-50 shadow-sm flex items-center gap-3 text-left hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    Order #{(order.order_number || order.id)?.toString().slice(-6)}
                  </p>
                  <p className="text-xs text-gray-400">{order.items?.length ?? 0} items · {timeAgo(order.created_at)}</p>
                </div>
                <p className="text-sm font-bold text-gray-900">{formatPrice(order.total_amount ?? order.total)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
