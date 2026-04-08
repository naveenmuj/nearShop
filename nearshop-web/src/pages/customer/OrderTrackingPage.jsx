import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { connectOrderTracking, getOrderDetail } from '../../api/orders'
import { useAuthStore } from '../../store/authStore'
import OrderTimeline from '../../components/OrderTimeline'

export default function OrderTrackingPage() {
  const { orderId } = useParams()
  const token = useAuthStore((s) => s.token)
  const [order, setOrder] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const wsRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    getOrderDetail(orderId)
      .then(({ data }) => { if (!cancelled) setOrder(data) })
      .catch(() => { if (!cancelled) setOrder(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [orderId])

  useEffect(() => {
    if (!token || !orderId) return
    wsRef.current = connectOrderTracking(orderId, token, (msg) => {
      setEvents((prev) => [msg, ...prev].slice(0, 20))
      if (msg?.status) {
        setOrder((prev) => prev ? { ...prev, status: msg.status } : prev)
      }
    })
    return () => wsRef.current?.close?.()
  }, [orderId, token])

  if (loading) return <div className="desktop-panel p-8 text-sm text-gray-500">Loading tracking view...</div>
  if (!order) return <div className="desktop-panel p-8 text-sm text-gray-500">Order not found.</div>

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="desktop-panel overflow-hidden">
        <div className="desktop-toolbar flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Track Order #{order.order_number || order.id}</h1>
            <p className="mt-1 text-sm text-gray-500">Live status updates for this order.</p>
          </div>
          <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase text-blue-700">{order.status}</span>
        </div>
        <div className="p-6">
          <OrderTimeline orderId={order.id} status={order.status} />
        </div>
      </section>

      <aside className="desktop-panel p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Live Events</h3>
        <div className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto">
          {events.length === 0 ? <p className="text-xs text-gray-400">No live updates yet.</p> : events.map((e, idx) => (
            <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
              <p className="text-xs font-semibold text-gray-800">{e?.status || e?.event || 'Update'}</p>
              <p className="text-xs text-gray-500">{e?.timestamp ? new Date(e.timestamp).toLocaleString('en-IN') : 'just now'}</p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  )
}
