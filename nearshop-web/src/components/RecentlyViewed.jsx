import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, X, ShoppingBag } from 'lucide-react'
import { getRecentlyViewed, clearRecentlyViewed } from '../api/engagement'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

function RecentlyViewedSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-28">
          <div className="skeleton-shimmer aspect-square w-28 rounded-xl" />
          <div className="mt-2 space-y-1">
            <div className="skeleton-shimmer h-3 rounded-md w-full" />
            <div className="skeleton-shimmer h-3 rounded-md w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function RecentlyViewed() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getRecentlyViewed(20)
      .then(({ data }) => setItems(data.items ?? data ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  const handleClear = async () => {
    try {
      await clearRecentlyViewed()
      setItems([])
    } catch {}
  }

  if (!loading && items.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <h2 className="text-base font-bold text-gray-900">Recently Viewed</h2>
        </div>
        <button
          onClick={handleClear}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-red transition"
        >
          <X className="w-3 h-3" /> Clear history
        </button>
      </div>

      {loading ? (
        <RecentlyViewedSkeleton />
      ) : (
        <div
          className="flex gap-3 overflow-x-auto pb-2"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {items.map((item) => {
            const product = item.product || item
            const pid = item.product_id || item.id
            const img = product.images?.[0] || product.image || null

            return (
              <button
                key={pid}
                onClick={() => navigate(`/app/product/${pid}`)}
                className="flex-shrink-0 w-28 text-left group"
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="aspect-square w-28 rounded-xl bg-gray-100 overflow-hidden border border-gray-100">
                  {img ? (
                    <img
                      src={img}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="w-8 h-8 text-gray-200" />
                    </div>
                  )}
                </div>
                <div className="mt-1.5">
                  <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight">{product.name}</p>
                  <p className="text-xs font-bold text-gray-900 mt-0.5">{formatPrice(product.price)}</p>
                  {product.shop_name && (
                    <p className="text-[10px] text-gray-400 truncate">{product.shop_name}</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
