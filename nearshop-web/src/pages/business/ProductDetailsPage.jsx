import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Eye,
  ShoppingBag,
  Star,
  TrendingUp,
  BarChart3,
  Trash2,
  Power,
  Tag,
} from 'lucide-react'
import toast from 'react-hot-toast'
import client from '../../api/client'
import { deleteProduct, getProduct, toggleAvailability } from '../../api/products'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const formatPrice = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-gray-500">
        <Icon className={`h-4 w-4 ${accent || ''}`} />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-xl font-extrabold text-gray-900">{value}</div>
    </div>
  )
}

export default function ProductDetailsPage() {
  const navigate = useNavigate()
  const { productId } = useParams()

  const [product, setProduct] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyAction, setBusyAction] = useState(null)

  const isLive = useMemo(() => {
    if (!product) return false
    return product.is_available ?? product.available ?? true
  }, [product])

  const loadData = useCallback(async () => {
    if (!productId) return

    try {
      const [productRes, analyticsRes] = await Promise.all([
        getProduct(productId),
        client.get(`/products/${productId}/analytics`).catch(() => ({ data: null })),
      ])

      setProduct(productRes?.data || null)
      setAnalytics(analyticsRes?.data || null)
    } catch {
      toast.error('Failed to load product details')
      setProduct(null)
      setAnalytics(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [productId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggleAvailability = useCallback(async () => {
    if (!product) return
    setBusyAction('toggle')
    try {
      await toggleAvailability(product.id)
      await loadData()
      toast.success(isLive ? 'Product hidden' : 'Product made live')
    } catch {
      toast.error('Failed to update availability')
    } finally {
      setBusyAction(null)
    }
  }, [isLive, loadData, product])

  const handleDelete = useCallback(async () => {
    if (!product) return
    const confirmed = window.confirm(`Delete "${product.name}"?`)
    if (!confirmed) return

    setBusyAction('delete')
    try {
      await deleteProduct(product.id)
      toast.success('Product deleted')
      navigate('/biz/catalog')
    } catch {
      toast.error('Failed to delete product')
    } finally {
      setBusyAction(null)
    }
  }, [navigate, product])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Product not found</h2>
        <p className="mt-2 text-sm text-gray-500">This product may have been removed.</p>
        <button
          onClick={() => navigate('/biz/catalog')}
          className="mt-5 rounded-xl bg-[#1D9E75] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#178a65]"
        >
          Back to Catalog
        </button>
      </div>
    )
  }

  const imageUrl = product.images?.[0] || product.image_url
  const views = analytics?.total_views ?? product.view_count ?? 0
  const orders = analytics?.total_orders ?? 0
  const conversion = analytics?.conversion_rate ?? 0
  const rating = analytics?.avg_rating ?? product.rating ?? 0

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Product Details</h1>
            <p className="text-xs text-gray-500">Insights and quick actions</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate(`/biz/deals?productId=${product.id}`)}
            className="inline-flex items-center gap-1 rounded-xl border border-[#1D9E75]/30 bg-[#1D9E75]/10 px-3 py-2 text-xs font-bold text-[#146d53] hover:bg-[#1D9E75]/20"
          >
            <Tag className="h-3.5 w-3.5" /> Create Deal
          </button>
          <button
            onClick={handleToggleAvailability}
            disabled={busyAction === 'toggle'}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <Power className="h-3.5 w-3.5" />
            {busyAction === 'toggle' ? 'Updating...' : isLive ? 'Hide Product' : 'Make Live'}
          </button>
          <button
            onClick={handleDelete}
            disabled={busyAction === 'delete'}
            className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-60"
          >
            <Trash2 className="h-3.5 w-3.5" /> {busyAction === 'delete' ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px,1fr]">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="aspect-square overflow-hidden rounded-xl bg-gray-50">
            {imageUrl ? (
              <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl text-gray-300">📦</div>
            )}
          </div>
          <div className="mt-4">
            <div className="mb-1 flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${isLive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {isLive ? 'LIVE' : 'HIDDEN'}
              </span>
              {product.category ? (
                <span className="rounded-full bg-[#EEEDFE] px-2.5 py-1 text-[10px] font-bold text-[#534AB7]">
                  {product.category}
                </span>
              ) : null}
            </div>
            <h2 className="text-xl font-extrabold text-gray-900">{product.name}</h2>
            <p className="mt-2 text-2xl font-black text-[#1D9E75]">{formatPrice(product.price)}</p>
            {product.description ? (
              <p className="mt-3 text-sm leading-relaxed text-gray-600">{product.description}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={Eye} label="Views" value={Number(views).toLocaleString('en-IN')} accent="text-indigo-500" />
            <StatCard icon={ShoppingBag} label="Orders" value={Number(orders).toLocaleString('en-IN')} accent="text-emerald-500" />
            <StatCard icon={TrendingUp} label="Conversion" value={`${Number(conversion || 0).toFixed(1)}%`} accent="text-amber-500" />
            <StatCard icon={Star} label="Rating" value={Number(rating || 0).toFixed(1)} accent="text-rose-500" />
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500">
              <BarChart3 className="h-4 w-4 text-[#7F77DD]" /> Performance Snapshot
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Revenue</p>
                <p className="mt-1 text-2xl font-black text-gray-900">{formatPrice(analytics?.total_revenue || 0)}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Wishlist Count</p>
                <p className="mt-1 text-2xl font-black text-gray-900">{Number(analytics?.wishlist_count || 0).toLocaleString('en-IN')}</p>
              </div>
            </div>

            <button
              onClick={() => {
                setRefreshing(true)
                loadData()
              }}
              disabled={refreshing}
              className="mt-4 inline-flex items-center rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {refreshing ? 'Refreshing...' : 'Refresh Analytics'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
