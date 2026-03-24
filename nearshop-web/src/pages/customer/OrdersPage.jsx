import { useState, useEffect } from 'react'
import { ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { getMyOrders, cancelOrder } from '../../api/orders'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import OrderCardSkeleton from '../../components/ui/OrderCardSkeleton'
import OrderTimeline from '../../components/OrderTimeline'
import { useConfirmDialog } from '../../components/ui/ConfirmDialog/useConfirmDialog'

const statusStyle = (s) => {
  const m = { pending: 'bg-amber-50 text-amber-600 border-amber-200', confirmed: 'bg-blue-50 text-blue-600 border-blue-200', completed: 'bg-green-50 text-green-600 border-green-200', delivered: 'bg-green-50 text-green-600 border-green-200', cancelled: 'bg-red-50 text-red-500 border-red-200', preparing: 'bg-purple-50 text-purple-600 border-purple-200' }
  return m[s?.toLowerCase()] || 'bg-gray-50 text-gray-500 border-gray-200'
}
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [activeFilter, setActiveFilter] = useState('all')
  const [expandedOrder, setExpandedOrder] = useState(null)
  const { confirm } = useConfirmDialog() || {}

  const fetchOrders = async () => {
    setLoading(true); setError(null)
    try { const { data } = await getMyOrders(); setOrders(data.items || data || []) }
    catch (err) { setError(err.message || 'Failed to load orders') } finally { setLoading(false) }
  }
  useEffect(() => { fetchOrders() }, [])

  const handleCancel = async (orderId) => {
    const ok = confirm
      ? await confirm({ title: 'Cancel Order', message: 'Are you sure you want to cancel this order?', confirmText: 'Yes, Cancel', cancelText: 'Keep Order', variant: 'danger' })
      : window.confirm('Cancel this order?')
    if (!ok) return
    setCancelling(orderId)
    try { await cancelOrder(orderId); toast.success('Order cancelled'); await fetchOrders() }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed to cancel order') } finally { setCancelling(null) }
  }

  const filtered = orders.filter(o => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'active') return ['pending', 'confirmed', 'preparing'].includes(o.status?.toLowerCase())
    if (activeFilter === 'completed') return ['completed', 'delivered'].includes(o.status?.toLowerCase())
    if (activeFilter === 'cancelled') return o.status?.toLowerCase() === 'cancelled'
    return false
  })

  if (loading) return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Orders</h1>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => <OrderCardSkeleton key={i} />)}
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {['All', 'Active', 'Completed', 'Cancelled'].map(tab => (
          <button key={tab} onClick={() => setActiveFilter(tab.toLowerCase())}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition whitespace-nowrap ${activeFilter === tab.toLowerCase() ? 'bg-brand-purple text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-brand-purple hover:text-brand-purple'}`}>
            {tab}
          </button>
        ))}
      </div>

      {error && <EmptyState icon={ShoppingBag} title="Could not load orders" message={error} action="Retry" onAction={fetchOrders} />}

      {!error && filtered.length === 0 ? (
        <EmptyState type="orders" />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase">Order</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase">Shop</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase">Items</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase">Total</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase">Date</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(order => (
                  <>
                    <tr key={order.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">#{order.order_number || order.id?.toString().slice(-6)}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{order.shop_name || 'Shop'}</td>
                      <td className="px-4 py-3 text-gray-600">{order.items_count || (order.items?.length) || 0} items</td>
                      <td className="px-4 py-3 font-bold text-gray-900">{formatPrice(order.total_amount || order.total)}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(order.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${statusStyle(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                            className="text-xs font-semibold text-brand-purple hover:underline flex items-center gap-1"
                          >
                            Track {expandedOrder === order.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                          {['pending', 'confirmed'].includes(order.status?.toLowerCase()) && (
                            <button onClick={() => handleCancel(order.id)} disabled={cancelling === order.id}
                              className="text-xs font-semibold text-brand-red hover:underline disabled:opacity-50">
                              {cancelling === order.id ? 'Cancelling...' : 'Cancel'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedOrder === order.id && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-gray-50">
                          <OrderTimeline orderId={order.id} status={order.status} />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(order => (
              <div key={order.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-mono text-xs text-gray-400">#{order.order_number || order.id?.toString().slice(-6)}</p>
                    <p className="font-semibold text-gray-800 mt-0.5">{order.shop_name || 'Order'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{order.items_count || (order.items?.length) || 0} items · {formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${statusStyle(order.status)}`}>{order.status}</span>
                    <p className="font-bold text-gray-900 mt-1">{formatPrice(order.total_amount || order.total)}</p>
                  </div>
                </div>

                {/* Track button */}
                <button
                  onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                  className="w-full flex items-center justify-center gap-2 mt-2 h-9 border border-brand-purple text-brand-purple rounded-lg text-sm font-medium hover:bg-brand-purple-light transition"
                >
                  {expandedOrder === order.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {expandedOrder === order.id ? 'Hide Tracking' : 'Track Order'}
                </button>

                {expandedOrder === order.id && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <OrderTimeline orderId={order.id} status={order.status} />
                  </div>
                )}

                {['pending', 'confirmed'].includes(order.status?.toLowerCase()) && (
                  <button onClick={() => handleCancel(order.id)} disabled={cancelling === order.id}
                    className="w-full mt-2 h-9 border border-brand-red text-brand-red rounded-lg text-sm font-medium hover:bg-brand-red-light transition disabled:opacity-50">
                    {cancelling === order.id ? 'Cancelling...' : 'Cancel Order'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
