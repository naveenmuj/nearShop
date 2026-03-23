import { useState, useEffect, useCallback } from 'react'
import { Plus, Minus, Trash2, Receipt, Share2, Copy, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { createBill, getBills, getBillStats } from '../../api/billing'
import { getShopProducts } from '../../api/shops'
import useMyShop from '../../hooks/useMyShop'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')
const PAY_METHODS = [
  { key: 'cash', label: 'Cash', icon: '💵' },
  { key: 'upi', label: 'UPI', icon: '📱' },
  { key: 'card', label: 'Card', icon: '💳' },
  { key: 'credit', label: 'Credit', icon: '📒' },
]

export default function BillingPage() {
  const { shopId } = useMyShop()
  const [tab, setTab] = useState('create') // 'create' | 'history' | 'stats'
  const [products, setProducts] = useState([])

  // Create bill state
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [billItems, setBillItems] = useState([])
  const [gstPct, setGstPct] = useState(0)
  const [discount, setDiscount] = useState(0)
  const [deliveryFee, setDeliveryFee] = useState(0)
  const [payMethod, setPayMethod] = useState('cash')
  const [notes, setNotes] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdBill, setCreatedBill] = useState(null)
  const [search, setSearch] = useState('')

  // History state
  const [bills, setBills] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (shopId) {
      getShopProducts(shopId, { per_page: 100 }).then(res => {
        const d = res.data
        setProducts(Array.isArray(d) ? d : d?.items ?? [])
      }).catch(() => {})
    }
  }, [shopId])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const [billsRes, statsRes] = await Promise.allSettled([
        getBills({ per_page: 50 }),
        getBillStats('30d'),
      ])
      if (billsRes.status === 'fulfilled') setBills(billsRes.value.data?.bills ?? [])
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data)
    } catch {} finally { setHistoryLoading(false) }
  }, [])

  useEffect(() => { if (tab === 'history' || tab === 'stats') loadHistory() }, [tab, loadHistory])

  // Bill calculations
  const subtotal = billItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const gstAmount = subtotal * gstPct / 100
  const total = subtotal + gstAmount - discount + deliveryFee

  const addProduct = (product) => {
    const existing = billItems.find(i => i.product_id === product.id)
    if (existing) {
      setBillItems(prev => prev.map(i => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i))
    } else {
      setBillItems(prev => [...prev, {
        product_id: product.id, name: product.name, price: Number(product.price), quantity: 1,
      }])
    }
  }

  const addCustomItem = () => {
    setBillItems(prev => [...prev, { product_id: '', name: '', price: 0, quantity: 1 }])
  }

  const updateItem = (idx, field, val) => {
    setBillItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item))
  }

  const removeItem = (idx) => setBillItems(prev => prev.filter((_, i) => i !== idx))

  const handleGenerate = async () => {
    if (billItems.length === 0) return toast.error('Add at least one item')
    setCreating(true)
    try {
      const res = await createBill({
        customer_name: customerName || undefined,
        customer_phone: customerPhone || undefined,
        items: billItems.map(i => ({ product_id: i.product_id || undefined, name: i.name, price: i.price, quantity: i.quantity })),
        gst_percentage: gstPct,
        discount_amount: discount,
        delivery_fee: deliveryFee,
        payment_method: payMethod,
        payment_status: payMethod === 'credit' ? 'unpaid' : 'paid',
        notes: notes || undefined,
      })
      setCreatedBill(res.data)
      toast.success('Bill generated!')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to generate bill')
    } finally { setCreating(false) }
  }

  const resetForm = () => {
    setCustomerName(''); setCustomerPhone(''); setBillItems([]); setGstPct(0)
    setDiscount(0); setDeliveryFee(0); setPayMethod('cash'); setNotes(''); setCreatedBill(null)
  }

  const shareWhatsApp = () => {
    if (!createdBill) return
    const items = createdBill.items.map(i => `  ${i.quantity}x ${i.name} — ${formatPrice(i.total)}`).join('\n')
    const text = `*Bill #${createdBill.bill_number}*\n${createdBill.shop?.name || ''}\n\n${items}\n\nSubtotal: ${formatPrice(createdBill.subtotal)}${createdBill.gst_amount > 0 ? `\nGST: ${formatPrice(createdBill.gst_amount)}` : ''}${createdBill.discount_amount > 0 ? `\nDiscount: -${formatPrice(createdBill.discount_amount)}` : ''}\n*Total: ${formatPrice(createdBill.total)}*\n\nPayment: ${createdBill.payment_method}\nDate: ${new Date(createdBill.created_at).toLocaleDateString('en-IN')}`
    window.open(`https://wa.me/${createdBill.customer_phone || ''}?text=${encodeURIComponent(text)}`)
  }

  const filteredProducts = search ? products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase())) : products.slice(0, 12)

  const inputCls = 'bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]/20 focus:border-[#1D9E75] w-full'
  const labelCls = 'text-xs font-semibold text-gray-500 mb-1 block'

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header + tabs */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">Billing</h1>
        <div className="flex gap-2 mt-2">
          {[['create', 'New Bill'], ['history', 'History'], ['stats', 'Stats']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === key ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Create Bill ─────────────────────────────── */}
      {tab === 'create' && !createdBill && (
        <div className="px-4 mt-4 space-y-4">
          {/* Customer */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-sm font-bold text-gray-800 mb-3">Customer (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Name</label><input value={customerName} onChange={e => setCustomerName(e.target.value)} className={inputCls} placeholder="Customer name" /></div>
              <div><label className={labelCls}>Phone</label><input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className={inputCls} placeholder="Phone" /></div>
            </div>
          </div>

          {/* Add products */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-800">Items</p>
              <button onClick={addCustomItem} className="text-xs font-semibold text-[#1D9E75] flex items-center gap-1"><Plus className="w-3 h-3" /> Custom Item</button>
            </div>
            {/* Quick-add from catalog */}
            <input value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} mb-2`} placeholder="Search your products..." />
            {search && (
              <div className="max-h-32 overflow-y-auto mb-3 border rounded-lg divide-y">
                {filteredProducts.map(p => (
                  <button key={p.id} onClick={() => { addProduct(p); setSearch('') }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left text-sm">
                    <span className="text-gray-800 truncate">{p.name}</span>
                    <span className="text-gray-500 font-semibold ml-2">{formatPrice(p.price)}</span>
                  </button>
                ))}
              </div>
            )}
            {/* Bill items list */}
            {billItems.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">Search and add products or add custom items</p>
            ) : (
              <div className="space-y-2">
                {billItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} className="flex-1 bg-transparent text-sm font-medium outline-none min-w-0" placeholder="Item name" />
                    <input type="number" value={item.price} onChange={e => updateItem(idx, 'price', Number(e.target.value))} className="w-20 bg-white border rounded px-2 py-1 text-sm text-right" />
                    <div className="flex items-center bg-white border rounded">
                      <button onClick={() => updateItem(idx, 'quantity', Math.max(1, item.quantity - 1))} className="px-1.5 py-1"><Minus className="w-3 h-3 text-gray-500" /></button>
                      <span className="px-2 text-sm font-bold">{item.quantity}</span>
                      <button onClick={() => updateItem(idx, 'quantity', item.quantity + 1)} className="px-1.5 py-1"><Plus className="w-3 h-3 text-gray-500" /></button>
                    </div>
                    <span className="text-sm font-bold text-gray-900 w-16 text-right">{formatPrice(item.price * item.quantity)}</span>
                    <button onClick={() => removeItem(idx)}><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-semibold">{formatPrice(subtotal)}</span></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><span className="text-gray-500">GST</span><input type="number" value={gstPct} onChange={e => setGstPct(Number(e.target.value))} className="w-14 border rounded px-2 py-0.5 text-xs text-center" placeholder="%" /><span className="text-xs text-gray-400">%</span></div>
                <span className="font-semibold">{formatPrice(gstAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Discount</span>
                <input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} className="w-24 border rounded px-2 py-0.5 text-xs text-right" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Delivery Fee</span>
                <input type="number" value={deliveryFee} onChange={e => setDeliveryFee(Number(e.target.value))} className="w-24 border rounded px-2 py-0.5 text-xs text-right" />
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200">
                <span className="font-bold text-gray-900">TOTAL</span>
                <span className="text-xl font-extrabold text-[#1D9E75]">{formatPrice(total)}</span>
              </div>
            </div>
          </div>

          {/* Payment method */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <p className="text-sm font-bold text-gray-800 mb-2">Payment Method</p>
            <div className="grid grid-cols-4 gap-2">
              {PAY_METHODS.map(m => (
                <button key={m.key} onClick={() => setPayMethod(m.key)}
                  className={`py-2 rounded-lg text-center transition-all border-2 ${payMethod === m.key ? 'border-[#1D9E75] bg-[#1D9E75]/5' : 'border-gray-200'}`}>
                  <span className="text-lg">{m.icon}</span>
                  <p className={`text-[10px] font-semibold mt-0.5 ${payMethod === m.key ? 'text-[#1D9E75]' : 'text-gray-500'}`}>{m.label}</p>
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleGenerate} disabled={creating || billItems.length === 0}
            className="w-full bg-[#1D9E75] text-white py-3.5 rounded-xl font-bold text-sm hover:bg-[#178a65] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            <Receipt className="w-4 h-4" /> {creating ? 'Generating...' : 'Generate Bill'}
          </button>
        </div>
      )}

      {/* ── Bill Preview (after creation) ────────────── */}
      {tab === 'create' && createdBill && (
        <div className="px-4 mt-4 space-y-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="text-center border-b border-dashed border-gray-200 pb-4 mb-4">
              <p className="text-lg font-bold text-gray-900">{createdBill.shop?.name}</p>
              {createdBill.shop?.address && <p className="text-xs text-gray-400 mt-0.5">{createdBill.shop.address}</p>}
              {createdBill.shop?.phone && <p className="text-xs text-gray-400">Ph: {createdBill.shop.phone}</p>}
              <p className="text-sm font-mono text-gray-500 mt-2">{createdBill.bill_number}</p>
              <p className="text-xs text-gray-400">{new Date(createdBill.created_at).toLocaleString('en-IN')}</p>
            </div>
            {createdBill.customer_name && <p className="text-sm text-gray-600 mb-3">Customer: {createdBill.customer_name} {createdBill.customer_phone ? `(${createdBill.customer_phone})` : ''}</p>}
            <div className="space-y-1 border-b border-dashed border-gray-200 pb-3 mb-3">
              {createdBill.items?.map((item, i) => (
                <div key={i} className="flex justify-between text-sm"><span className="text-gray-700">{item.quantity}x {item.name}</span><span className="text-gray-900 font-medium">{formatPrice(item.total)}</span></div>
              ))}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatPrice(createdBill.subtotal)}</span></div>
              {createdBill.gst_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">GST ({createdBill.gst_percentage}%)</span><span>{formatPrice(createdBill.gst_amount)}</span></div>}
              {createdBill.discount_amount > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span>-{formatPrice(createdBill.discount_amount)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-200"><span>Total</span><span className="text-[#1D9E75]">{formatPrice(createdBill.total)}</span></div>
            </div>
            <p className="text-xs text-center text-gray-400 mt-3">Payment: {createdBill.payment_method} · Status: {createdBill.payment_status}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={shareWhatsApp} className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl font-bold text-sm"><Share2 className="w-4 h-4" /> WhatsApp</button>
            <button onClick={() => { navigator.clipboard?.writeText(JSON.stringify(createdBill, null, 2)); toast.success('Copied!') }} className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-3 rounded-xl font-bold text-sm"><Copy className="w-4 h-4" /></button>
          </div>
          <button onClick={resetForm} className="w-full bg-[#1D9E75] text-white py-3 rounded-xl font-bold text-sm">+ New Bill</button>
        </div>
      )}

      {/* ── History ──────────────────────────────────── */}
      {tab === 'history' && (
        <div className="px-4 mt-4 space-y-3">
          {historyLoading ? <div className="py-12 text-center"><LoadingSpinner /></div> : (
            <>
              {stats && (
                <div className="grid grid-cols-2 gap-3 mb-2">
                  <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
                    <p className="text-lg font-extrabold text-[#1D9E75]">{formatPrice(stats.total_revenue)}</p>
                    <p className="text-[10px] text-gray-400 font-medium">Revenue (30d)</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm text-center">
                    <p className="text-lg font-extrabold text-gray-900">{stats.total_bills}</p>
                    <p className="text-[10px] text-gray-400 font-medium">Bills (30d)</p>
                  </div>
                </div>
              )}
              {bills.length === 0 ? (
                <div className="text-center py-12"><FileText className="w-10 h-10 text-gray-200 mx-auto mb-3" /><p className="text-gray-500 font-medium">No bills yet</p></div>
              ) : bills.map(bill => (
                <div key={bill.id} className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-gray-400">{bill.bill_number}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bill.payment_status === 'paid' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                      {bill.payment_status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{bill.customer_name || 'Walk-in'}</p>
                      <p className="text-xs text-gray-400">{bill.items?.length || 0} items · {bill.payment_method}</p>
                    </div>
                    <p className="text-base font-extrabold text-gray-900">{formatPrice(bill.total)}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{new Date(bill.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── Stats ────────────────────────────────────── */}
      {tab === 'stats' && stats && (
        <div className="px-4 mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Total Bills', value: stats.total_bills, icon: '🧾' },
              { label: 'Revenue', value: formatPrice(stats.total_revenue), icon: '💰' },
              { label: 'Avg Bill', value: formatPrice(stats.avg_bill_value), icon: '📊' },
              { label: 'GST Collected', value: formatPrice(stats.total_gst_collected), icon: '🏛️' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <span className="text-xl">{s.icon}</span>
                <p className="text-xl font-extrabold text-gray-900 mt-1">{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
