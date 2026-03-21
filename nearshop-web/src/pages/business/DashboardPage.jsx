import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Store } from 'lucide-react'
import toast from 'react-hot-toast'
import { getShopStats } from '../../api/analytics'
import { getShopOrders } from '../../api/orders'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import useMyShop from '../../hooks/useMyShop'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { shop, shopId } = useMyShop()
  const [stats, setStats] = useState(null)
  const [pendingOrders, setPendingOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!shopId) return
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [statsRes, ordersRes] = await Promise.all([
          getShopStats(shopId, '7d'),
          getShopOrders(shopId, { status: 'pending', limit: 5 }),
        ])
        setStats(statsRes.data)
        setPendingOrders(ordersRes.data.items || ordersRes.data || [])
      } catch {
        // silently ignore
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [shopId])

  if (loading && shopId) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const shopName = shop?.name || 'there'

  const statCards = [
    { label: 'Total Orders', value: stats?.total_orders ?? 0, change: 'This week', borderColor: 'border-brand-purple' },
    { label: 'Revenue', value: `₹${stats?.total_revenue ?? 0}`, change: 'This week', borderColor: 'border-brand-green' },
    { label: 'Views', value: stats?.total_views ?? 0, change: 'This week', borderColor: 'border-brand-amber' },
    { label: 'Visitors', value: stats?.unique_visitors ?? 0, change: 'This week', borderColor: 'border-brand-blue' },
  ]

  const insight = {
    message: stats
      ? `You've had ${stats.total_orders ?? 0} orders and ₹${stats.total_revenue ?? 0} in revenue this week. Keep it up!`
      : 'Add products and share your shop link to start getting orders from nearby customers.',
  }

  return (
    <div className="bg-gray-50 min-h-screen px-4 py-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-gray-400 font-medium">Good morning,</p>
          <h1 className="text-xl font-bold text-brand-purple leading-tight">{shopName}! 👋</h1>
        </div>
        <button className="w-10 h-10 bg-white rounded-2xl shadow-card flex items-center justify-center relative">
          <Bell className="h-5 w-5 text-gray-500" />
          {pendingOrders.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-red rounded-full text-white text-[9px] font-bold flex items-center justify-center">
              {pendingOrders.length}
            </span>
          )}
        </button>
      </div>

      {!shopId && (
        <button
          onClick={() => navigate('/biz/settings')}
          className="w-full bg-[#FAEEDA] border border-brand-amber rounded-2xl p-4 mb-5 flex items-center gap-3 text-left"
        >
          <Store className="h-8 w-8 text-brand-amber flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-800">Create your shop to get started</p>
            <p className="text-xs text-gray-500 mt-0.5">Tap here → Settings → fill in your shop name</p>
          </div>
        </button>
      )}

      {/* Stats 2x2 grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {statCards.map((stat) => (
          <div key={stat.label} className={`bg-white rounded-2xl shadow-card p-4 border-l-4 ${stat.borderColor}`}>
            <p className="text-xs text-gray-400 font-medium">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</p>
            <p className="text-xs text-brand-green mt-1">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* AI Insight card */}
      <div className="rounded-2xl p-4 text-white mb-5" style={{ background: 'linear-gradient(135deg, #7F77DD, #3B8BD4)' }}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">✨</span>
          <div>
            <p className="font-semibold text-sm">AI Insight</p>
            <p className="text-white/80 text-xs mt-1 leading-relaxed">{insight.message}</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mb-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
        <div className="grid grid-cols-4 gap-3">
          {[
            { icon: '📸', label: 'Add Product', to: '/biz/snap' },
            { icon: '🎁', label: 'Create Deal', to: '/biz/deals/new' },
            { icon: '📖', label: 'Add Story', to: '/biz/stories/new' },
            { icon: '📊', label: 'Analytics', to: '/biz/analytics' },
          ].map((a) => (
            <button
              key={a.label}
              onClick={() => navigate(a.to)}
              className="bg-white rounded-2xl shadow-card p-3 flex flex-col items-center gap-1.5 hover:shadow-card-hover transition-all active:scale-95"
            >
              <span className="text-2xl">{a.icon}</span>
              <span className="text-[10px] text-gray-500 font-medium text-center leading-tight">{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Orders needing attention */}
      {pendingOrders.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Needs Attention</p>
            <button onClick={() => navigate('/biz/orders')} className="text-xs text-brand-purple font-semibold">View all</button>
          </div>
          <div className="flex flex-col gap-2">
            {pendingOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl shadow-card p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Order #{order.id?.toString().slice(-6)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">₹{order.total_amount || order.total}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-[#FAEEDA] text-brand-amber px-2 py-1 rounded-full font-medium">Pending</span>
                  <button
                    onClick={() => navigate('/biz/orders')}
                    className="text-xs bg-brand-purple text-white px-3 py-1.5 rounded-xl font-semibold"
                  >
                    Manage
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
