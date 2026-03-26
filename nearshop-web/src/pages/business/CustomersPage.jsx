import { useState, useEffect, useCallback } from 'react'
import { Search, Phone, ShoppingBag, Users, AlertTriangle, Crown, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import useMyShop from '../../hooks/useMyShop'
import { getShopOrders } from '../../api/orders'
import { getCustomerSegments } from '../../api/ai'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

const SEGMENT_ICONS = {
  'Champions': '🏆', 'Loyal': '💎', 'Potential Loyalist': '🌟',
  'At Risk': '⚠️', "Can't Lose": '🚨', 'Lost': '👻',
  'New Customers': '🆕', 'Others': '👤',
}

export default function CustomersPage() {
  const { shopId } = useMyShop()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [segments, setSegments] = useState(null)
  const [segmentFilter, setSegmentFilter] = useState('all')
  const [segmentLoading, setSegmentLoading] = useState(false)

  const load = useCallback(async () => {
    if (!shopId) return
    try {
      const res = await getShopOrders(shopId, { per_page: 500 })
      const orders = Array.isArray(res.data) ? res.data : res.data?.items ?? []
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

  const loadSegments = useCallback(async () => {
    if (!shopId) return
    setSegmentLoading(true)
    try {
      const res = await getCustomerSegments(shopId)
      setSegments(res.data)
    } catch {} finally { setSegmentLoading(false) }
  }, [shopId])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadSegments() }, [loadSegments])

  // Merge segment data into customer list
  const customerWithSegments = customers.map(c => {
    const seg = segments?.customers?.find(s => s.customer_id === c.id)
    return { ...c, segment: seg?.segment, segment_color: seg?.segment_color, win_back_action: seg?.win_back_action }
  })

  const filtered = customerWithSegments.filter(c => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search)
    const matchSegment = segmentFilter === 'all' || c.segment === segmentFilter
    return matchSearch && matchSegment
  })

  const segmentList = segments?.segments ? Object.entries(segments.segments).sort((a, b) => b[1] - a[1]) : []

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

      {/* RFM Segment Summary */}
      {segments?.summary && (
        <div className="px-4 mt-3 grid grid-cols-3 gap-2">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <Crown className="w-5 h-5 text-green-600 mx-auto" />
            <p className="text-lg font-extrabold text-green-700 mt-1">{segments.summary.champions_count}</p>
            <p className="text-[10px] text-green-600 font-semibold">Champions</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto" />
            <p className="text-lg font-extrabold text-amber-700 mt-1">{segments.summary.at_risk_count}</p>
            <p className="text-[10px] text-amber-600 font-semibold">At Risk</p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-center">
            <Users className="w-5 h-5 text-gray-500 mx-auto" />
            <p className="text-lg font-extrabold text-gray-700 mt-1">{segments.summary.total}</p>
            <p className="text-[10px] text-gray-500 font-semibold">Total</p>
          </div>
        </div>
      )}

      {/* Segment filter pills */}
      {segmentList.length > 0 && (
        <div className="flex gap-1.5 px-4 mt-3 overflow-x-auto pb-1">
          <button onClick={() => setSegmentFilter('all')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${segmentFilter === 'all' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
            All
          </button>
          {segmentList.map(([seg, count]) => (
            <button key={seg} onClick={() => setSegmentFilter(seg)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${segmentFilter === seg ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {SEGMENT_ICONS[seg] || '👤'} {seg} ({count})
            </button>
          ))}
        </div>
      )}

      <div className="px-4 mt-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-gray-500 font-medium">No customers yet</p>
            <p className="text-xs text-gray-400 mt-1">Customers will appear here after their first order</p>
          </div>
        ) : filtered.map(c => (
          <div key={c.id} className="bg-white rounded-xl p-3.5 border border-gray-100 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: c.segment_color || '#7F77DD' }}>
              {(c.name || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                {c.segment && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap"
                    style={{ backgroundColor: c.segment_color + '20', color: c.segment_color }}>
                    {SEGMENT_ICONS[c.segment]} {c.segment}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" />{c.orders} orders</span>
                <span>{formatPrice(c.totalSpent)} spent</span>
              </div>
              {c.win_back_action && (c.segment === 'At Risk' || c.segment === "Can't Lose" || c.segment === 'Lost') && (
                <p className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> {c.win_back_action}
                </p>
              )}
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
