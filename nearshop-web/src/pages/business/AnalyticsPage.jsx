import { useState, useEffect } from 'react'
import { BarChart3, Package, MapPin } from 'lucide-react'
import { getShopStats, getProductAnalytics, getDemandInsights } from '../../api/analytics'
import { useLocation } from '../../hooks/useLocation'
import useMyShop from '../../hooks/useMyShop'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

const PERIODS = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
]

export default function AnalyticsPage() {
  const { shopId } = useMyShop()
  const { latitude, longitude } = useLocation()
  const [period, setPeriod] = useState('7d')
  const [stats, setStats] = useState(null)
  const [productData, setProductData] = useState([])
  const [demandData, setDemandData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = async () => {
    if (!shopId) return
    setLoading(true)
    setError(null)
    try {
      const requests = [
        getShopStats(shopId, period),
        getProductAnalytics(shopId),
      ]
      if (latitude && longitude) {
        requests.push(getDemandInsights(shopId, latitude, longitude))
      }
      const [statsRes, prodRes, demandRes] = await Promise.all(requests)
      setStats(statsRes.data)
      setProductData(prodRes.data.items || prodRes.data || [])
      if (demandRes) setDemandData(demandRes.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [shopId, period])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen px-4 py-4">
        <h1 className="text-xl font-bold mb-4">📊 Analytics</h1>
        <EmptyState icon={BarChart3} title="Could not load analytics" message={error} action="Retry" onAction={fetchAll} />
      </div>
    )
  }

  const statCards = [
    { label: 'Revenue', value: `₹${stats?.total_revenue || 0}`, borderColor: 'border-brand-green' },
    { label: 'Orders', value: stats?.total_orders || 0, borderColor: 'border-brand-purple' },
    { label: 'Unique Visitors', value: stats?.unique_visitors || 0, borderColor: 'border-brand-blue' },
    { label: 'Views', value: stats?.total_views || 0, borderColor: 'border-brand-amber' },
  ]

  return (
    <div className="bg-gray-50 min-h-screen px-4 py-4 pb-24">
      {/* Header + period selector */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">📊 Analytics</h1>
        <div className="flex bg-gray-100 rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors ${
                period === p.value ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Key stats 2x2 grid */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          {statCards.map((stat) => (
            <div key={stat.label} className={`bg-white rounded-2xl shadow-card p-4 border-l-4 ${stat.borderColor}`}>
              <p className="text-xs text-gray-400 font-medium">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">{stat.value}</p>
              <p className="text-xs text-brand-green mt-1">{period} period</p>
            </div>
          ))}
        </div>
      )}

      {/* Top products */}
      {productData.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Package className="h-4 w-4 text-brand-blue" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Top Products</p>
          </div>
          <div className="bg-white rounded-2xl shadow-card overflow-hidden">
            {productData.slice(0, 5).map((item, idx) => (
              <div
                key={item.product_id || idx}
                className={`p-3 flex items-center justify-between ${idx < Math.min(productData.length, 5) - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-brand-purple-light text-brand-purple text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-medium text-sm text-gray-800">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.view_count || 0} views</p>
                  </div>
                </div>
                <p className="font-bold text-sm text-brand-purple">{item.inquiry_count || 0} inquiries</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demand insights */}
      {demandData !== null && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 text-brand-red" />
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Demand Insights</p>
          </div>
          <div className="bg-white rounded-2xl shadow-card p-4">
            {Array.isArray(demandData) && demandData.length > 0 ? (
              <ul className="space-y-2">
                {demandData.map((item, idx) => (
                  <li key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">• {item.query}</span>
                    <span className="text-brand-purple font-semibold text-xs">({item.count})</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No demand insights available yet</p>
            )}
          </div>
        </div>
      )}

      {!stats && !productData.length && (
        <EmptyState icon={BarChart3} title="No data yet" message="Analytics will appear once you start receiving orders" />
      )}
    </div>
  )
}
