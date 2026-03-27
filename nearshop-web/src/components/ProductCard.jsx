import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Eye } from 'lucide-react'
import QuickViewModal from './QuickViewModal'
import { getRankingReasonLabel, getRankingReasonTone } from '../utils/ranking'
import { rankingSearchParams, trackRankingClick } from '../utils/rankingTracking'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

export default function ProductCard({ product, onWishlistToggle, className = '', tracking = null }) {
  const navigate = useNavigate()
  const {
    id,
    name,
    price,
    compare_price,
    images,
    shop_name,
    is_wishlisted,
    reason,
  } = product
  const image_url = images?.[0] ?? null
  const reasonLabel = getRankingReasonLabel(reason, '')
  const reasonTone = getRankingReasonTone(reason)

  const [wishlisted, setWishlisted] = useState(is_wishlisted ?? false)
  const [showQuickView, setShowQuickView] = useState(false)

  const handleWishlist = (e) => {
    e.stopPropagation()
    const next = !wishlisted
    setWishlisted(next)
    onWishlistToggle?.(id, next)
  }

  const handleQuickView = (e) => {
    e.stopPropagation()
    setShowQuickView(true)
  }

  const hasDiscount = compare_price != null && compare_price > price
  const discountPct = hasDiscount ? Math.round(((compare_price - price) / compare_price) * 100) : null

  const handleProductClick = () => {
    if (tracking?.ranking_surface) {
      trackRankingClick(product, tracking)
      navigate(`/app/product/${id}${rankingSearchParams({
        ...tracking,
        ranking_reason: product.reason || tracking.ranking_reason,
      })}`)
      return
    }
    navigate(`/app/product/${id}`)
  }

  return (
    <>
      <div
        className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden group cursor-pointer ${className}`}
        onClick={handleProductClick}
      >
        {/* Image */}
        <div className="relative aspect-square bg-gray-100 overflow-hidden">
          {image_url ? (
            <img
              src={image_url}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
              No image
            </div>
          )}
          {discountPct && (
            <span className="absolute top-2 left-2 bg-brand-red text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              -{discountPct}%
            </span>
          )}
          <button
            onClick={handleWishlist}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors"
          >
            <Heart className={`h-4 w-4 ${wishlisted ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
          </button>

          {/* Quick View — only shows on devices that support hover (desktop) */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center pb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto"
            style={{ display: 'none' }}
            /* Hidden by default, shown via CSS hover below — but we use JS approach for broader compat */
          />
          <button
            onClick={handleQuickView}
            className="absolute inset-x-2 bottom-2 hidden md:flex items-center justify-center gap-1.5 bg-white/90 backdrop-blur-sm text-gray-800 text-xs font-semibold py-1.5 rounded-lg border border-gray-200 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-sm hover:bg-white"
          >
            <Eye className="w-3.5 h-3.5" /> Quick View
          </button>
        </div>

        {/* Info */}
        <div className="px-3 py-2.5">
          <h4 className="text-sm font-medium text-gray-900 truncate">{name}</h4>
          {reasonLabel && (
            <span className={`inline-flex mt-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${reasonTone}`}>
              {reasonLabel}
            </span>
          )}
          {shop_name && <p className="text-xs text-gray-500 mt-0.5 truncate">{shop_name}</p>}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-sm font-bold text-gray-900">
              {formatPrice(price)}
            </span>
            {hasDiscount && (
              <span className="text-xs text-gray-400 line-through">
                {formatPrice(compare_price)}
              </span>
            )}
          </div>
        </div>
      </div>

      {showQuickView && (
        <QuickViewModal product={product} onClose={() => setShowQuickView(false)} />
      )}
    </>
  )
}
