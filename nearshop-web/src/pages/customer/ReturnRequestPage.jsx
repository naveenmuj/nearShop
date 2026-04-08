import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getMyOrders } from '../../api/orders'
import { createReturnRequest, getReturnReasons } from '../../api/returns'

export default function ReturnRequestPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const preselectedOrderId = searchParams.get('orderId')

  const [orders, setOrders] = useState([])
  const [reasons, setReasons] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    orderId: preselectedOrderId || '',
    productId: '',
    reason: '',
    description: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: orderData }, { data: reasonsData }] = await Promise.all([getMyOrders({ per_page: 100 }), getReturnReasons()])
      const orderItems = orderData?.items || orderData || []
      setOrders(orderItems)
      setReasons(reasonsData?.reasons || reasonsData || [])
    } catch {
      setOrders([])
      setReasons([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const selectedOrder = useMemo(() => orders.find((o) => String(o.id) === String(form.orderId)), [orders, form.orderId])
  const selectedItem = useMemo(() => (selectedOrder?.items || []).find((i) => String(i.product_id || i.id) === String(form.productId)), [selectedOrder, form.productId])

  const submit = async (e) => {
    e.preventDefault()
    if (!form.orderId || !form.productId || !form.reason) {
      toast.error('Please complete all required fields')
      return
    }
    setSubmitting(true)
    try {
      await createReturnRequest({
        order_id: form.orderId,
        product_id: selectedItem?.product_id || selectedItem?.id,
        item_name: selectedItem?.name || selectedItem?.product_name,
        item_quantity: selectedItem?.quantity || 1,
        item_price: selectedItem?.price,
        reason: form.reason,
        description: form.description || null,
      })
      toast.success('Return request submitted')
      navigate('/app/returns')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to submit return request')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="desktop-panel p-8 text-sm text-gray-500">Loading return form...</div>

  return (
    <form onSubmit={submit} className="desktop-panel overflow-hidden">
      <div className="desktop-toolbar px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">Request Return</h1>
        <p className="text-sm text-gray-500">Submit item return with reason and notes.</p>
      </div>

      <div className="grid gap-4 p-6 lg:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Order</span>
          <select value={form.orderId} onChange={(e) => setForm((f) => ({ ...f, orderId: e.target.value, productId: '' }))} className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm" required>
            <option value="">Select order</option>
            {orders.map((o) => <option key={o.id} value={o.id}>#{o.order_number || o.id} - {o.shop_name || 'Shop'}</option>)}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Item</span>
          <select value={form.productId} onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))} className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm" required>
            <option value="">Select item</option>
            {(selectedOrder?.items || []).map((i) => <option key={i.product_id || i.id} value={i.product_id || i.id}>{i.name || i.product_name} (Qty {i.quantity || 1})</option>)}
          </select>
        </label>

        <label className="space-y-1 lg:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reason</span>
          <select value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm" required>
            <option value="">Select reason</option>
            {reasons.map((r) => {
              const value = typeof r === 'string' ? r : r.value
              const label = typeof r === 'string' ? r : r.label
              return <option key={value} value={value}>{label}</option>
            })}
          </select>
        </label>

        <label className="space-y-1 lg:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Description</span>
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={4} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Add details about the issue" />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50/60 px-6 py-4">
        <p className="text-xs text-gray-500">Selected item price: {selectedItem?.price ? `₹${selectedItem.price}` : '-'} {selectedOrder?.order_number ? `• Order #${selectedOrder.order_number}` : ''}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => navigate('/app/returns')} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-lg bg-[#3f5efb] px-4 py-2 text-sm font-semibold text-white hover:bg-[#334ed4] disabled:opacity-60">{submitting ? 'Submitting...' : 'Submit Request'}</button>
        </div>
      </div>
    </form>
  )
}
