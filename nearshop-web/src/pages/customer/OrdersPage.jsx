import { useState, useEffect } from 'react'
import { ShoppingBag } from 'lucide-react'
import toast from 'react-hot-toast'
import { getMyOrders, cancelOrder } from '../../api/orders'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

const statusColor = (status) => {
  const map = {
    pending: 'bg-brand-amber-light text-brand-amber',
    confirmed: 'bg-brand-blue-light text-brand-blue',
    completed: 'bg-brand-green-light text-brand-green',
    cancelled: 'bg-brand-red-light text-brand-red',
    delivered: 'bg-brand-green-light text-brand-green',
    preparing: 'bg-brand-purple-light text-brand-purple',
  }
  return map[status?.toLowerCase()] || 'bg-gray-100 text-gray-500'
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')

  const fetchOrders = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await getMyOrders()
      setOrders(data.items || data || [])
    } catch (err) {
      setError(err.message || 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const handleCancel = async (orderId) => {
    if (!window.confirm('Cancel this order?')) return
    setCancelling(orderId)
    try {
      await cancelOrder(orderId)
      toast.success('Order cancelled')
      await fetchOrders()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to cancel order')
    } finally {
      setCancelling(null)
    }
  }

  const filteredOrders = orders.filter((order) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'active') return ['pending', 'confirmed', 'preparing'].includes(order.status?.toLowerCase())
    if (activeFilter === 'completed') return ['completed', 'delivered'].includes(order.status?.toLowerCase())
    if (activeFilter === 'cancelled') return order.status?.toLowerCase() === 'cancelled'
    return false
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <div className="bg-white px-4 py-4 border-b border-gray-100">
          <h1 className="font-bold text-xl text-gray-900">📦 My Orders</h1>
        </div>
        <div className="px-4 py-4">
          <EmptyState icon={ShoppingBag} title="Could not load orders" message={error} action="Retry" onAction={fetchOrders} />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-6">
      {/* Header */}
      <div className="bg-white px-4 py-4 border-b border-gray-100">
        <h1 className="font-bold text-xl text-gray-900">📦 My Orders</h1>
      </div>

      {/* Tab pills */}
      <div className="flex gap-2 px-4 overflow-x-auto py-3 bg-white border-b border-gray-100">
        {['All', 'Active', 'Completed', 'Cancelled'].map(tab => (
          <button key={tab} onClick={() => setActiveFilter(tab.toLowerCase())}
            className={`flex-shrink-0 px-4 py-2 rounded-2xl text-sm font-bold transition-all ${activeFilter === tab.toLowerCase() ? 'bg-[#5B2BE7] text-white shadow-sm shadow-purple-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {tab}
          </button>
        ))}
      </div>

      <div className="px-4 pt-4 space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center px-8">
            <div className="text-7xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-700">No orders yet</h3>
            <p className="text-sm text-gray-400 mt-2">Your orders will appear here</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl shadow-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs text-gray-400">#{order.order_number || order.id?.toString().slice(-6) || order.id}</p>
                  <p className="font-semibold text-gray-800 mt-0.5">{order.shop_name || 'Order'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {order.items_count || (order.items && order.items.length) || 0} items · {formatDate(order.created_at)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor(order.status)}`}>{order.status}</span>
                  <span className="font-bold text-gray-900">₹{order.total_amount || order.total}</span>
                </div>
              </div>
              {['pending', 'confirmed'].includes(order.status?.toLowerCase()) && (
                <button
                  onClick={() => handleCancel(order.id)}
                  disabled={cancelling === order.id}
                  className="w-full h-10 border border-brand-red text-brand-red rounded-xl text-sm font-medium hover:bg-brand-red-light transition-colors disabled:opacity-50"
                >
                  {cancelling === order.id ? 'Cancelling...' : 'Cancel Order'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
