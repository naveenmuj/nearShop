import { useState, useEffect, useCallback } from 'react'
import { Search, Phone, ShoppingBag } from 'lucide-react'
import useMyShop from '../../hooks/useMyShop'
import { getShopOrders } from '../../api/orders'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

export default function CustomersPage() {
  const { shopId } = useMyShop()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!shopId) return
    try {
      const res = await getShopOrders(shopId, { per_page: 500 })
      const orders = Array.isArray(res.data) ? res.data : res.data?.items ?? []
      // Aggregate customers from orders
      const map = new Map()
      orders.forEach(order => {
        const id = order.customer_id
        if (!id) return
        if (!map.has(id)) {
          map.set(id, {
            id, name: order.customer_name || 'Customer',
            phone: order.customer_phone || '',
            orders: 0, totalSpent: 0, lastOrder: null,
          })
        }
        const c = map.get(id)
        c.orders++
        c.totalSpent += Number(order.total_amount || order.total || 0)
        const d = new Date(order.created_at)
        if (!c.lastOrder || d > c.lastOrder) c.lastOrder = d
      })
      setCustomers(Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent))
    } catch {} finally { setLoading(false) }
  }, [shopId])

  useEffect(() => { load() }, [load])

  const filtered = search
    ? customers.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
    : customers

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <div className="bg-white px-4 py-3 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">Customers</h1>
        <p className="text-xs text-gray-400">{customers.length} customers from orders</p>
        <div className="flex items-center bg-gray-100 rounded-lg px-3 h-9 mt-2.5">
          <Search className="w-3.5 h-3.5 text-gray-400 mr-2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone..."
            className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder-gray-400" />
        </div>
      </div>

      <div className="px-4 mt-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-gray-500 font-medium">No customers yet</p>
            <p className="text-xs text-gray-400 mt-1">Customers will appear here after their first order</p>
          </div>
        ) : filtered.map(c => (
          <div key={c.id} className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#7F77DD] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {(c.name || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" />{c.orders} orders</span>
                <span>{formatPrice(c.totalSpent)} spent</span>
              </div>
            </div>
            {c.phone && (
              <a href={`tel:${c.phone}`} className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                <Phone className="w-3.5 h-3.5 text-green-600" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
