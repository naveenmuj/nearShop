import { useState, useEffect, useCallback } from 'react'
import { ShoppingBag } from 'lucide-react'
import toast from 'react-hot-toast'
import { getShopOrders, updateOrderStatus } from '../../api/orders'
import useMyShop from '../../hooks/useMyShop'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

const TABS = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled']

const STATUS_COLORS = {
  pending: 'bg-[#FAEEDA] text-brand-amber',
  confirmed: 'bg-brand-blue-light text-brand-blue',
  preparing: 'bg-[#FAEEDA] text-brand-amber',
  ready: 'bg-brand-green-light text-brand-green',
  delivered: 'bg-brand-green-light text-brand-green',
  cancelled: 'bg-brand-red-light text-brand-red',
}

const NEXT_STATUS = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function OrdersPage() {
  const { shopId } = useMyShop()
  const [activeTab, setActiveTab] = useState('pending')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [acting, setActing] = useState(null)

  const fetchOrders = useCallback(async () => {
    if (!shopId) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await getShopOrders(shopId, { status: activeTab })
      setOrders(data.items || data || [])
    } catch (err) {
      setError(err.message || 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [shopId, activeTab])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Poll pending orders every 15 seconds
  useEffect(() => {
    if (activeTab !== 'pending') return
    const interval = setInterval(fetchOrders, 15000)
    return () => clearInterval(interval)
  }, [activeTab, fetchOrders])

  const handleStatusChange = async (orderId, newStatus) => {
    setActing(orderId)
    try {
      await updateOrderStatus(orderId, newStatus)
      toast.success(`Order marked as ${newStatus}`)
      fetchOrders()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update order')
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold text-gray-900">🛒 Orders</h1>
      </div>

      {/* Tab pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 px-4 mb-4 scrollbar-hide">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-4 py-2 rounded-2xl text-xs font-bold capitalize transition-all ${
              activeTab === tab
                ? 'bg-[#5B2BE7] text-white shadow-sm shadow-purple-200'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-[#5B2BE7]/30'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="px-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <EmptyState icon={ShoppingBag} title="Could not load orders" message={error} action="Retry" onAction={fetchOrders} />
        ) : orders.length === 0 ? (
          <EmptyState icon={ShoppingBag} title={`No ${activeTab} orders`} message="Incoming orders will appear here" />
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl shadow-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-brand-purple-light flex items-center justify-center text-xs font-bold text-brand-purple">
                        {order.customer_name?.[0]?.toUpperCase() || '#'}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-800">
                          {order.customer_name || 'Customer'}
                        </p>
                        <p className="text-xs text-gray-400">#{order.id?.toString().slice(-6)}</p>
                      </div>
                    </div>
                    <div className="mt-2 space-y-1">
                      {(order.items || []).slice(0, 2).map((item, i) => (
                        <p key={i} className="text-xs text-gray-600">
                          {item.quantity || item.qty}× {item.product_name || item.name}
                        </p>
                      ))}
                      {order.items?.length > 2 && (
                        <p className="text-xs text-gray-400">+{order.items.length - 2} more</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">₹{order.total_amount || order.total}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatTime(order.created_at)}</p>
                    <span
                      className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${
                        STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                {order.status === 'pending' ? (
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <button
                      onClick={() => handleStatusChange(order.id, 'cancelled')}
                      disabled={acting === order.id}
                      className="h-10 border border-brand-red text-brand-red rounded-xl text-sm font-semibold hover:bg-brand-red-light transition-colors disabled:opacity-50"
                    >
                      ✕ Reject
                    </button>
                    <button
                      onClick={() => handleStatusChange(order.id, NEXT_STATUS[order.status])}
                      disabled={acting === order.id}
                      className="h-10 bg-brand-green text-white rounded-xl text-sm font-semibold hover:bg-brand-green/90 transition-colors disabled:opacity-50"
                    >
                      {acting === order.id ? '...' : '✓ Accept'}
                    </button>
                  </div>
                ) : NEXT_STATUS[order.status] ? (
                  <div className="mt-3">
                    <button
                      onClick={() => handleStatusChange(order.id, NEXT_STATUS[order.status])}
                      disabled={acting === order.id}
                      className="w-full h-10 bg-brand-purple text-white rounded-xl text-sm font-semibold hover:bg-brand-purple-dark transition-colors disabled:opacity-50 capitalize"
                    >
                      {acting === order.id ? '...' : `Mark ${NEXT_STATUS[order.status]}`}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
