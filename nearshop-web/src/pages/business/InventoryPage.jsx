import { useState, useEffect, useCallback } from 'react'
import { Package, AlertTriangle, TrendingUp, Plus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { getLowStock, getStockValue, getMargins, restockProduct } from '../../api/inventory'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

export default function InventoryPage() {
  const [tab, setTab] = useState('overview')
  const [value, setValue] = useState(null)
  const [lowStock, setLowStock] = useState([])
  const [margins, setMargins] = useState([])
  const [loading, setLoading] = useState(true)

  // Restock modal
  const [restockItem, setRestockItem] = useState(null)
  const [restockQty, setRestockQty] = useState('')
  const [restockPrice, setRestockPrice] = useState('')
  const [restockSupplier, setRestockSupplier] = useState('')
  const [restocking, setRestocking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [valRes, lowRes, margRes] = await Promise.allSettled([
        getStockValue(), getLowStock(), getMargins(),
      ])
      if (valRes.status === 'fulfilled') setValue(valRes.value.data)
      if (lowRes.status === 'fulfilled') setLowStock(Array.isArray(lowRes.value.data) ? lowRes.value.data : [])
      if (margRes.status === 'fulfilled') setMargins(Array.isArray(margRes.value.data) ? margRes.value.data : [])
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleRestock = async () => {
    if (!restockQty || Number(restockQty) <= 0) return toast.error('Enter quantity')
    setRestocking(true)
    try {
      await restockProduct({
        product_id: restockItem.id,
        quantity: Number(restockQty),
        purchase_price: restockPrice ? Number(restockPrice) : undefined,
        supplier_name: restockSupplier || undefined,
      })
      toast.success(`Restocked ${restockItem.name}`)
      setRestockItem(null); setRestockQty(''); setRestockPrice(''); setRestockSupplier('')
      await load()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to restock')
    } finally { setRestocking(false) }
  }

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">Inventory</h1>
        <div className="flex gap-2 mt-2">
          {[['overview', 'Overview'], ['alerts', `Low Stock (${lowStock.length})`], ['margins', 'Margins']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === key ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">
        {/* Overview */}
        {tab === 'overview' && value && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <Package className="w-5 h-5 text-[#7F77DD] mb-2" />
                <p className="text-xl font-extrabold text-gray-900">{value.tracked_products}</p>
                <p className="text-xs text-gray-400">Tracked Products</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <span className="text-xl">📦</span>
                <p className="text-xl font-extrabold text-gray-900 mt-1">{value.total_units}</p>
                <p className="text-xs text-gray-400">Total Units</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <span className="text-xl">💰</span>
                <p className="text-xl font-extrabold text-gray-900 mt-1">{formatPrice(value.cost_value)}</p>
                <p className="text-xs text-gray-400">Cost Value</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <span className="text-xl">🏷️</span>
                <p className="text-xl font-extrabold text-gray-900 mt-1">{formatPrice(value.retail_value)}</p>
                <p className="text-xs text-gray-400">Retail Value</p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-[#1D9E75] to-[#2DB88A] rounded-xl p-4 text-white">
              <p className="text-sm opacity-80">Potential Profit</p>
              <p className="text-2xl font-extrabold mt-1">{formatPrice(value.potential_profit)}</p>
              <p className="text-xs opacity-70 mt-1">Retail value minus cost value</p>
            </div>
          </>
        )}

        {/* Low Stock Alerts */}
        {tab === 'alerts' && (
          <>
            {lowStock.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">All stocked up!</p>
                <p className="text-xs text-gray-400 mt-1">No products below their stock threshold</p>
              </div>
            ) : lowStock.map(p => (
              <div key={p.id} className={`bg-white rounded-xl p-3.5 border shadow-sm flex items-center gap-3 ${p.stock === 0 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="w-12 h-12 rounded-lg bg-white overflow-hidden flex-shrink-0 border">
                  {p.image ? <img src={p.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300">📦</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs font-bold ${p.stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {p.stock === 0 ? 'OUT OF STOCK' : `${p.stock} left`}
                    </span>
                    <span className="text-xs text-gray-400">threshold: {p.threshold}</span>
                  </div>
                </div>
                <button onClick={() => setRestockItem(p)}
                  className="bg-[#1D9E75] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Restock
                </button>
              </div>
            ))}
          </>
        )}

        {/* Margin Report */}
        {tab === 'margins' && (
          <>
            {margins.length === 0 ? (
              <div className="text-center py-12">
                <TrendingUp className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No margin data</p>
                <p className="text-xs text-gray-400 mt-1">Set purchase prices on your products to see margins</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {margins.map((p, i) => (
                  <div key={p.id} className={`flex items-center px-4 py-3 ${i < margins.length - 1 ? 'border-b border-gray-50' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Cost: {formatPrice(p.cost_price)} | Sell: {formatPrice(p.selling_price)}
                        {p.stock != null && ` | Stock: ${p.stock}`}
                      </p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-bold text-[#1D9E75]">{formatPrice(p.margin)}</p>
                      <p className="text-[10px] text-gray-400">{p.margin_pct}% margin</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Restock Modal */}
      {restockItem && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setRestockItem(null)} />
          <div className="relative w-full max-w-lg bg-white rounded-t-2xl p-5 pb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Restock: {restockItem.name}</h3>
              <button onClick={() => setRestockItem(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Quantity to add *</label>
                <input type="number" value={restockQty} onChange={e => setRestockQty(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-lg font-bold outline-none focus:ring-2 focus:ring-[#1D9E75]/20" placeholder="e.g. 50" autoFocus />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Purchase price per unit</label>
                <input type="number" value={restockPrice} onChange={e => setRestockPrice(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" placeholder="Cost price (optional)" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Supplier</label>
                <input value={restockSupplier} onChange={e => setRestockSupplier(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" placeholder="Supplier name (optional)" />
              </div>
              <button onClick={handleRestock} disabled={restocking}
                className="w-full bg-[#1D9E75] text-white py-3 rounded-xl font-bold text-sm disabled:opacity-50">
                {restocking ? 'Restocking...' : 'Confirm Restock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
