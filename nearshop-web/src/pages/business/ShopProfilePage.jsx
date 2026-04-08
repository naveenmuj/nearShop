import { useMemo } from 'react'
import { getShopStats } from '../../api/analytics'
import useMyShop from '../../hooks/useMyShop'
import { useEffect, useState } from 'react'

const formatPrice = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`

export default function ShopProfilePage() {
  const { shop, shopId, loading: shopLoading } = useMyShop()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!shopId) return
    setLoading(true)
    getShopStats(shopId, '30d')
      .then((res) => setStats(res.data))
      .catch(() => setStats(null))
      .finally(() => setLoading(false))
  }, [shopId])

  const cards = useMemo(() => ([
    { label: 'Orders', value: stats?.total_orders || 0 },
    { label: 'Revenue', value: formatPrice(stats?.total_revenue || 0) },
    { label: 'Views', value: stats?.total_views || 0 },
    { label: 'Visitors', value: stats?.unique_visitors || 0 },
    { label: 'Products', value: stats?.total_products || shop?.products_count || 0 },
    { label: 'Reviews', value: stats?.total_reviews || shop?.total_reviews || 0 },
  ]), [shop, stats])

  if (shopLoading || loading) return <div className="desktop-panel p-8 text-sm text-gray-500">Loading shop profile...</div>

  return (
    <div className="space-y-4">
      <div className="desktop-panel overflow-hidden">
        <div className="bg-gradient-to-br from-[#0f766e] to-[#0ea5e9] px-6 py-8 text-white">
          <h1 className="text-3xl font-bold">{shop?.name || 'My Shop'}</h1>
          {shop?.category ? <p className="mt-1 text-sm text-white/85">{shop.category}</p> : null}
          {shop?.created_at ? <p className="mt-2 text-xs text-white/75">Member since {new Date(shop.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p> : null}
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-3 lg:grid-cols-6">
          {cards.map((c) => (
            <div key={c.label} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{c.label}</p>
              <p className="mt-1 text-lg font-bold text-gray-900">{c.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="desktop-panel p-5">
        <h2 className="text-lg font-bold text-gray-900">Business Details</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><p className="text-xs font-semibold text-gray-500">Description</p><p className="mt-1 text-sm text-gray-700">{shop?.description || '-'}</p></div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><p className="text-xs font-semibold text-gray-500">Address</p><p className="mt-1 text-sm text-gray-700">{shop?.address || '-'}</p></div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><p className="text-xs font-semibold text-gray-500">Phone</p><p className="mt-1 text-sm text-gray-700">{shop?.phone || '-'}</p></div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3"><p className="text-xs font-semibold text-gray-500">WhatsApp</p><p className="mt-1 text-sm text-gray-700">{shop?.whatsapp || shop?.phone || '-'}</p></div>
        </div>
      </div>
    </div>
  )
}
