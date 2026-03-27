import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, Eye, Users, ShoppingBag, DollarSign, Search } from 'lucide-react'
import { getShopStats, getProductAnalytics, getDemandInsights, getOperationalInsights } from '../../api/analytics'
import { getShopOrders } from '../../api/orders'
import useMyShop from '../../hooks/useMyShop'
import { useLocationStore } from '../../store/locationStore'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

const PERIODS = ['7d', '30d', '90d']
const PERIOD_LABELS = { '7d': '7 Days', '30d': '30 Days', '90d': '90 Days' }

const STATUS_COLORS = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-600', bar: 'bg-amber-400' },
  confirmed: { bg: 'bg-blue-50', text: 'text-blue-600', bar: 'bg-blue-400' },
  preparing: { bg: 'bg-purple-50', text: 'text-purple-600', bar: 'bg-purple-400' },
  ready: { bg: 'bg-teal-50', text: 'text-teal-600', bar: 'bg-teal-400' },
  completed: { bg: 'bg-green-50', text: 'text-green-600', bar: 'bg-green-400' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-600', bar: 'bg-red-400' },
}

export default function AnalyticsPage() {
  const navigate = useNavigate()
  const { shopId } = useMyShop()
  const { latitude, longitude } = useLocationStore()
  const [period, setPeriod] = useState('7d')
  const [stats, setStats] = useState(null)
  const [products, setProducts] = useState([])
  const [demand, setDemand] = useState([])
  const [operationalInsights, setOperationalInsights] = useState(null)
  const [orderBreakdown, setOrderBreakdown] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const results = await Promise.allSettled([
        getShopStats(shopId, period),
        getProductAnalytics(shopId),
        getDemandInsights(shopId, latitude ?? 12.935, longitude ?? 77.624),
        getOperationalInsights(shopId, latitude ?? 12.935, longitude ?? 77.624),
        getShopOrders(shopId, { per_page: 200 }),
      ])
      if (results[0].status === 'fulfilled') setStats(results[0].value.data)
      if (results[1].status === 'fulfilled') {
        const d = results[1].value.data
        setProducts(Array.isArray(d) ? d : d?.items ?? [])
      }
      if (results[2].status === 'fulfilled') {
        const d = results[2].value.data
        setDemand(Array.isArray(d) ? d : d?.items ?? [])
      }
      if (results[3].status === 'fulfilled') setOperationalInsights(results[3].value.data ?? null)
      if (results[4].status === 'fulfilled') {
        const orders = results[4].value.data
        const list = Array.isArray(orders) ? orders : orders?.items ?? []
        const b = {}
        list.forEach(o => { b[o.status] = (b[o.status] || 0) + 1 })
        setOrderBreakdown(b)
      }
    } catch {} finally { setLoading(false) }
  }, [shopId, period, latitude, longitude])

  useEffect(() => { load() }, [load])

  const conversion = stats?.total_views > 0 ? ((stats.total_orders / stats.total_views) * 100).toFixed(1) : '0'
  const avgOrder = stats?.total_orders > 0 ? (stats.total_revenue / stats.total_orders).toFixed(0) : '0'
  const forecast = operationalInsights?.sales_forecast
  const reorderAlerts = operationalInsights?.reorder_alerts ?? []
  const segmentSummary = operationalInsights?.customer_segments?.summary
  const segmentBreakdown = operationalInsights?.customer_segments?.segments
    ? Object.entries(operationalInsights.customer_segments.segments).sort((a, b) => b[1] - a[1])
    : []
  const recommendedActions = operationalInsights?.recommended_actions ?? []
  const insightsMeta = operationalInsights?.meta
  const warnings = insightsMeta?.warnings ?? []
  const actionRouteMap = {
    analytics: '/biz/analytics',
    inventory: '/biz/inventory',
    marketing: '/biz/marketing',
    deals: '/biz/deals',
    customers: '/biz/customers',
  }

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">Analytics & Insights</h1>
        <div className="flex gap-2 mt-2.5">
          {PERIODS.map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                period === p ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-4 mt-4">
        {/* Revenue highlight */}
        <div className="bg-gradient-to-r from-[#1D9E75] to-[#2DB88A] rounded-2xl p-5 text-white">
          <p className="text-sm opacity-80">Total Revenue</p>
          <p className="text-3xl font-extrabold mt-1">{formatPrice(stats?.total_revenue ?? 0)}</p>
          <p className="text-xs opacity-70 mt-1">{PERIOD_LABELS[period]} · {stats?.total_orders ?? 0} orders</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Eye, label: 'Views', value: stats?.total_views ?? 0, color: '#EF9F27' },
            { icon: Users, label: 'Visitors', value: stats?.unique_visitors ?? 0, color: '#3B8BD4' },
            { icon: ShoppingBag, label: 'Orders', value: stats?.total_orders ?? 0, color: '#7F77DD' },
            { icon: DollarSign, label: 'Avg Order', value: formatPrice(avgOrder), color: '#1D9E75' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <p className="text-xl font-extrabold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400 font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Conversion rate */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-medium">Conversion Rate</p>
            <p className="text-2xl font-extrabold text-[#7F77DD]">{conversion}%</p>
          </div>
          <div className="text-right text-xs text-gray-400">
            <p>{stats?.total_orders ?? 0} orders</p>
            <p>from {stats?.total_views ?? 0} views</p>
          </div>
        </div>

        {forecast && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-400 font-medium">7-Day Revenue Forecast</p>
              <p className="text-2xl font-extrabold text-[#1D9E75] mt-1">{formatPrice(forecast.next_7_days_revenue)}</p>
              <p className="text-xs text-gray-500 mt-1">
                Avg/day {formatPrice(forecast.recent_daily_avg_revenue)}
                {forecast.revenue_trend_pct != null && ` · ${forecast.revenue_trend_pct >= 0 ? '+' : ''}${forecast.revenue_trend_pct}% vs previous week`}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <p className="text-xs text-gray-400 font-medium">7-Day Orders Forecast</p>
              <p className="text-2xl font-extrabold text-[#7F77DD] mt-1">{forecast.next_7_days_orders}</p>
              <p className="text-xs text-gray-500 mt-1">
                Avg/day {Number(forecast.recent_daily_avg_orders ?? 0).toFixed(1)}
                {forecast.orders_trend_pct != null && ` · ${forecast.orders_trend_pct >= 0 ? '+' : ''}${forecast.orders_trend_pct}% vs previous week`}
              </p>
            </div>
          </div>
        )}

        {insightsMeta && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-bold text-gray-900">Operational Insights Quality</p>
                <p className="text-xs text-gray-500 mt-1">
                  Orders analysed {insightsMeta.sample_sizes?.orders_last_30_days ?? 0} ·
                  Stocked products {insightsMeta.sample_sizes?.active_stocked_products ?? 0} ·
                  Customers segmented {insightsMeta.sample_sizes?.customers_segmented ?? 0}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">Forecast {String(insightsMeta.confidence?.forecast || 'low').toUpperCase()}</span>
                <span className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">Demand {String(insightsMeta.confidence?.demand || 'low').toUpperCase()}</span>
                <span className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">Segments {String(insightsMeta.confidence?.segments || 'low').toUpperCase()}</span>
              </div>
            </div>
            {warnings.length > 0 && (
              <div className="mt-4 space-y-2">
                {warnings.map((warning) => (
                  <div key={warning} className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800 font-medium">
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(segmentSummary || segmentBreakdown.length > 0) && (
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-2.5">Customer Segments</h3>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-[11px] font-semibold text-emerald-600">Champions</p>
                  <p className="text-xl font-extrabold text-emerald-700 mt-1">{segmentSummary?.champions_count ?? 0}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-[11px] font-semibold text-amber-600">At Risk</p>
                  <p className="text-xl font-extrabold text-amber-700 mt-1">{segmentSummary?.at_risk_count ?? 0}</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-3">
                  <p className="text-[11px] font-semibold text-slate-500">Total</p>
                  <p className="text-xl font-extrabold text-slate-700 mt-1">{segmentSummary?.total ?? 0}</p>
                </div>
              </div>
              <div className="space-y-2">
                {segmentBreakdown.slice(0, 5).map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">{name}</span>
                    <span className="font-bold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-2.5">Recommended Actions</h3>
          <div className="space-y-3">
            {recommendedActions.map((action) => (
              <div key={action.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{action.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{action.description}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                    action.priority === 'high'
                      ? 'bg-red-100 text-red-700'
                      : action.priority === 'medium'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}>
                    {action.priority}
                  </span>
                </div>
                {Array.isArray(action.highlights) && action.highlights.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {action.highlights.map((item) => (
                      <p key={item} className="text-xs text-gray-700">• {item}</p>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => action.target && actionRouteMap[action.target] && navigate(actionRouteMap[action.target])}
                    className="px-3 py-2 rounded-lg bg-[#1D9E75] text-white text-xs font-semibold"
                  >
                    {action.cta_label || 'Open'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-2.5">Reorder Alerts</h3>
          {reorderAlerts.length === 0 ? (
            <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
              <p className="text-sm text-gray-400">No urgent stock issues detected</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {reorderAlerts.map((item, index) => (
                <div key={item.product_id || index} className="px-4 py-3 border-b border-gray-50 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.product_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Stock {item.stock_quantity} · velocity {item.daily_sales_velocity}/day
                        {item.days_left != null && ` · ${item.days_left} days left`}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.severity === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {item.severity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Suggested reorder: <span className="font-bold text-gray-900">{item.recommended_reorder_qty}</span>
                    {item.estimated_revenue_at_risk > 0 && ` · Revenue at risk ${formatPrice(item.estimated_revenue_at_risk)}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Order breakdown */}
        {Object.keys(orderBreakdown).length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-2.5">Order Status</h3>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {Object.entries(orderBreakdown).map(([status, count]) => {
                const total = Object.values(orderBreakdown).reduce((a, b) => a + b, 0)
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                const colors = STATUS_COLORS[status] || { bg: 'bg-gray-50', text: 'text-gray-500', bar: 'bg-gray-400' }
                return (
                  <div key={status} className="flex items-center px-4 py-2.5 border-b border-gray-50 last:border-b-0">
                    <span className={`text-xs font-semibold capitalize w-20 ${colors.text}`}>{status}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full mx-3">
                      <div className={`h-2 rounded-full ${colors.bar}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-bold text-gray-900 w-8 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top products */}
        {products.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-2.5">Top Products</h3>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {products.slice(0, 8).map((p, i) => (
                <div key={p.id || i} className="flex items-center px-4 py-3 border-b border-gray-50 last:border-b-0">
                  <span className="w-6 h-6 rounded-full bg-[#EEEDFE] text-[#7F77DD] text-[10px] font-bold flex items-center justify-center mr-3">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{formatPrice(p.price)} · {p.view_count ?? 0} views · {p.wishlist_count ?? 0} wishlists</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${p.is_available ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {p.is_available ? 'Live' : 'Off'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Demand insights */}
        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-1">Demand Insights</h3>
          <p className="text-xs text-gray-400 mb-2.5">Top searches near your shop</p>
          {demand.length === 0 ? (
            <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
              <Search className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No search data nearby yet</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {demand.map((item, i) => {
                const text = typeof item === 'string' ? item : item.query || item.term
                const count = item.count
                return (
                  <div key={i} className="flex items-center bg-blue-50 rounded-full px-3 py-1.5 border border-blue-100">
                    <span className="text-xs font-semibold text-blue-700">{text}</span>
                    {count != null && <span className="ml-1.5 text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full">{count}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
