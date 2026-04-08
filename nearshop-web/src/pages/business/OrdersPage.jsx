import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, X, ChevronRight, Phone, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { getShopOrders, updateOrderStatus } from '../../api/orders'
import useMyShop from '../../hooks/useMyShop'
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

const COLUMNS = [
  { key: 'pending',   label: 'New',        color: '#EF9F27', bg: '#FFF8EB' },
  { key: 'confirmed', label: 'Confirmed',  color: '#3B8BD4', bg: '#EFF6FF' },
  { key: 'preparing', label: 'Preparing',  color: '#7F77DD', bg: '#F3F0FF' },
  { key: 'ready',     label: 'Ready',      color: '#5DCAA5', bg: '#ECFDF5' },
  { key: 'completed', label: 'Done',       color: '#1D9E75', bg: '#E1F5EE' },
]

const NEXT_STATUS = { pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'completed' }
const NEXT_LABEL = { confirmed: 'Start Preparing', preparing: 'Mark Ready', ready: 'Complete' }

const TABS = ['all', 'pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']

export default function OrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { shopId } = useMyShop()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'all')
  const pollRef = useRef(null)

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    if (activeTab && activeTab !== 'all') next.set('tab', activeTab)
    else next.delete('tab')
    setSearchParams(next, { replace: true })
  }, [activeTab, searchParams, setSearchParams])

  useEffect(() => {
    const savedY = Number(sessionStorage.getItem('bizOrdersScrollY') || 0)
    if (savedY > 0) requestAnimationFrame(() => window.scrollTo({ top: savedY, behavior: 'auto' }))
    const onScroll = () => {
      sessionStorage.setItem('bizOrdersScrollY', String(window.scrollY || 0))
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const load = useCallback(async (silent = false) => {
    if (!shopId) return
    if (!silent) setLoading(true)
    try {
      const res = await getShopOrders(shopId, { per_page: 100 })
      const d = res.data
      setOrders(Array.isArray(d) ? d : d?.items ?? [])
    } catch {
      if (!silent) toast.error('Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => { load() }, [load])

  // Poll for new orders every 15s
  useEffect(() => {
    pollRef.current = setInterval(() => load(true), 15000)
    return () => clearInterval(pollRef.current)
  }, [load])

  const handleStatus = async (orderId, status) => {
    setActing(orderId)
    try {
      await updateOrderStatus(orderId, status)
      toast.success(status === 'cancelled' ? 'Order rejected' : `Order ${status}`)
      await load(true)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update')
    } finally {
      setActing(null)
    }
  }

  const filtered = activeTab === 'all' ? orders : orders.filter(o => o.status === activeTab)
  const pendingCount = orders.filter(o => o.status === 'pending').length
  const desktopColumns = COLUMNS.map((column) => ({
    ...column,
    orders: filtered.filter((order) => order.status === column.key),
  }))

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Orders</h1>
            <p className="text-xs text-gray-400">{orders.length} total · {pendingCount} pending</p>
          </div>
          <button onClick={() => load()} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="bg-white border-b border-gray-100 px-2 overflow-x-auto">
        <div className="flex gap-1 py-2">
          {TABS.map(tab => {
            const count = tab === 'all' ? orders.length : orders.filter(o => o.status === tab).length
            const active = activeTab === tab
            return (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  active ? 'bg-[#1D9E75] text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {count > 0 && <span className={`ml-1 ${active ? 'text-white/80' : 'text-gray-400'}`}>({count})</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Orders list */}
      <div className="px-4 py-3 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500 font-medium">No {activeTab === 'all' ? '' : activeTab} orders</p>
          </div>
        ) : (
          <>
          <div className="hidden lg:grid lg:grid-cols-5 lg:gap-3">
            {desktopColumns.map((column) => (
              <div key={column.key} className="rounded-xl border border-gray-200 bg-white">
                <div className="sticky top-0 z-10 border-b border-gray-100 px-3 py-2" style={{ backgroundColor: column.bg }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: column.color }}>{column.label}</p>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-semibold" style={{ color: column.color }}>{column.orders.length}</span>
                  </div>
                </div>
                <div className="max-h-[70vh] space-y-2 overflow-y-auto p-2">
                  {column.orders.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-400">No orders</div>
                  ) : column.orders.map((order) => {
                    const next = NEXT_STATUS[order.status]
                    const isPending = order.status === 'pending'
                    const isActing = acting === order.id
                    const items = order.items || []

                    return (
                      <div key={order.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <div>
                            <p className="text-[11px] font-mono text-gray-400">#{(order.order_number || order.id)?.toString().slice(-8)}</p>
                            <p className="truncate text-sm font-semibold text-gray-900">{order.customer_name || 'Customer'}</p>
                          </div>
                          <span className="text-[11px] text-gray-400">{timeAgo(order.created_at)}</span>
                        </div>
                        <p className="mb-1 text-xs text-gray-500">{items.length} items</p>
                        <p className="mb-2 text-sm font-bold text-gray-900">{formatPrice(order.total_amount ?? order.total)}</p>

                        {isPending ? (
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => handleStatus(order.id, 'confirmed')}
                              disabled={isActing}
                              className="rounded-md bg-[#1D9E75] px-2 py-1.5 text-xs font-semibold text-white hover:bg-[#178a65] disabled:opacity-50"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleStatus(order.id, 'cancelled')}
                              disabled={isActing}
                              className="rounded-md bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : next ? (
                          <button
                            onClick={() => handleStatus(order.id, next)}
                            disabled={isActing}
                            className="w-full rounded-md border px-2 py-1.5 text-xs font-semibold disabled:opacity-50"
                            style={{ borderColor: column.color, color: column.color, backgroundColor: column.bg }}
                          >
                            {NEXT_LABEL[order.status] || `Move to ${next}`}
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3 lg:hidden">
          {filtered.map(order => {
            const col = COLUMNS.find(c => c.key === order.status) || { color: '#9CA3AF', bg: '#F3F4F6' }
            const next = NEXT_STATUS[order.status]
            const isPending = order.status === 'pending'
            const isActing = acting === order.id
            const items = order.items || []

            return (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Status indicator bar */}
                <div className="h-1" style={{ backgroundColor: col.color }} />

                <div className="p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs font-mono text-gray-400">#{(order.order_number || order.id)?.toString().slice(-8)}</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">
                        {order.customer_name || 'Customer'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: col.bg, color: col.color }}>
                        {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
                      </span>
                      <span className="text-xs text-gray-400">{timeAgo(order.created_at)}</span>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="bg-gray-50 rounded-lg p-2.5 mb-3">
                    {items.slice(0, 3).map((item, i) => (
                      <div key={i} className="flex justify-between text-xs py-0.5">
                        <span className="text-gray-600">{item.quantity}x {item.name}</span>
                        <span className="text-gray-500">{formatPrice(item.total || item.price * item.quantity)}</span>
                      </div>
                    ))}
                    {items.length > 3 && <p className="text-xs text-gray-400 mt-0.5">+{items.length - 3} more items</p>}
                  </div>

                  {/* Total + delivery */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{order.delivery_type === 'delivery' ? '🚚 Delivery' : '🏪 Pickup'}</span>
                      {order.delivery_fee > 0 && <span>· Fee {formatPrice(order.delivery_fee)}</span>}
                    </div>
                    <p className="text-base font-extrabold text-gray-900">{formatPrice(order.total_amount ?? order.total)}</p>
                  </div>

                  {/* Action buttons */}
                  {isPending && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStatus(order.id, 'confirmed')}
                        disabled={isActing}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-[#1D9E75] text-white py-2.5 rounded-xl text-sm font-bold hover:bg-[#178a65] transition-colors disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" /> Accept
                      </button>
                      <button
                        onClick={() => handleStatus(order.id, 'cancelled')}
                        disabled={isActing}
                        className="flex items-center justify-center gap-1.5 bg-red-50 text-red-600 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        <X className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  )}

                  {next && !isPending && (
                    <button
                      onClick={() => handleStatus(order.id, next)}
                      disabled={isActing}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 border-2"
                      style={{ borderColor: col.color, color: col.color, backgroundColor: col.bg }}
                    >
                      {NEXT_LABEL[order.status] || `Move to ${next}`} <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
          </div>
          </>
        )}
      </div>
    </div>
  )
}
