import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getOrderDetail, downloadInvoice } from '../../api/orders'
import OrderTimeline from '../../components/OrderTimeline'
import { PageTransition } from '../../components/ui/PageTransition'

const formatPrice = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`

export default function OrderDetailPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getOrderDetail(orderId)
      .then(({ data }) => { if (!cancelled) setOrder(data) })
      .catch(() => { if (!cancelled) setOrder(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [orderId])

  const download = async () => {
    if (!order) return
    const response = await downloadInvoice(order.id)
    const blob = new Blob([response.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `invoice_${order.order_number || order.id}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  if (loading) return <div className="desktop-panel p-8 text-sm text-gray-500">Loading order detail...</div>
  if (!order) return <div className="desktop-panel p-8 text-sm text-gray-500">Order not found.</div>

  return (
    <PageTransition>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="desktop-panel overflow-hidden">
        <div className="desktop-toolbar flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Order #{order.order_number || order.id}</h1>
            <p className="text-sm text-gray-500">Placed {order.created_at ? new Date(order.created_at).toLocaleString('en-IN') : '-'}</p>
          </div>
          <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold uppercase text-blue-700">{order.status}</span>
        </div>
        <div className="p-6">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-gray-500"><tr><th className="py-2">Item</th><th className="py-2">Qty</th><th className="py-2">Unit</th><th className="py-2 text-right">Total</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {(order.items || []).map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2 font-medium text-gray-900">{item.name || item.product_name}</td>
                  <td className="py-2 text-gray-600">{item.quantity || 1}</td>
                  <td className="py-2 text-gray-600">{formatPrice(item.price)}</td>
                  <td className="py-2 text-right font-semibold text-gray-900">{formatPrice((item.quantity || 1) * (item.price || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 border-t border-gray-200 pt-3 text-right text-sm font-bold text-gray-900">Grand Total: {formatPrice(order.total_amount || order.total)}</div>
          <div className="mt-4">
            <OrderTimeline orderId={order.id} status={order.status} />
          </div>
        </div>
      </section>

      <aside className="desktop-panel h-fit p-5 lg:sticky lg:top-24">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Actions</h3>
        <div className="mt-3 space-y-2">
          <button onClick={() => navigate(`/app/orders/${order.id}/tracking`)} className="w-full rounded-lg border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50">Open Tracking View</button>
          <button onClick={download} className="w-full rounded-lg border border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50">Download Invoice</button>
          <button onClick={() => navigate(`/app/returns/request?orderId=${order.id}`)} className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-left text-sm font-semibold text-blue-700 hover:bg-blue-100">Request Return</button>
          <button onClick={() => navigate('/app/orders')} className="w-full rounded-lg bg-[#3f5efb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#334ed4]">Back to Orders</button>
        </div>
      </aside>
    </div>
    </PageTransition>
  )
}
