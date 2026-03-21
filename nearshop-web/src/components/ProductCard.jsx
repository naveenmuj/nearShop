import { useState } from 'react'
import { Heart } from 'lucide-react'

export default function ProductCard({ product, onWishlistToggle, className = '' }) {
  const {
    id,
    name,
    price,
    compare_price,
    images,
    shop_name,
    is_wishlisted,
  } = product
  const image_url = images?.[0] ?? null

  const [wishlisted, setWishlisted] = useState(is_wishlisted ?? false)

  const handleWishlist = (e) => {
    e.stopPropagation()
    const next = !wishlisted
    setWishlisted(next)
    onWishlistToggle?.(id, next)
  }

  const hasDiscount = compare_price != null && compare_price > price

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden group ${className}`}>
      {/* Image */}
      <div className="relative aspect-square bg-gray-100">
        {image_url ? (
          <img src={image_url} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">No image</div>
        )}
        {hasDiscount && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            -{Math.round(((compare_price - price) / compare_price) * 100)}%
          </span>
        )}
        <button
          onClick={handleWishlist}
          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors"
        >
          <Heart className={`h-4 w-4 ${wishlisted ? 'fill-red-500 text-red-500' : 'text-gray-500'}`} />
        </button>
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <h4 className="text-sm font-medium text-gray-900 truncate">{name}</h4>
        {shop_name && <p className="text-xs text-gray-500 mt-0.5 truncate">{shop_name}</p>}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-sm font-bold text-primary-700">
            ₹{price.toLocaleString()}
          </span>
          {hasDiscount && (
            <span className="text-xs text-gray-400 line-through">
              ₹{compare_price.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
