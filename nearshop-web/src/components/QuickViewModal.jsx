import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { X, ShoppingBag, Heart, Minus, Plus, Store, ExternalLink } from 'lucide-react'
import { addToWishlist, removeFromWishlist } from '../api/wishlists'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

export default function QuickViewModal({ product, onClose }) {
  const [quantity, setQuantity] = useState(1)
  const [wishlisted, setWishlisted] = useState(product?.is_wishlisted ?? false)
  const [currentImg, setCurrentImg] = useState(0)
  const [closing, setClosing] = useState(false)

  const close = useCallback(() => {
    setClosing(true)
    setTimeout(onClose, 180)
  }, [onClose])

  // ESC key + body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handler = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', handler)
    }
  }, [close])

  if (!product) return null

  const images = product.images?.length ? product.images : product.image ? [product.image] : []
  const shop = product.shop || {}
  const discountPct = product.compare_price && product.price && Number(product.compare_price) > Number(product.price)
    ? Math.round((1 - product.price / product.compare_price) * 100) : null

  const handleWishlist = async (e) => {
    e.stopPropagation()
    try {
      if (wishlisted) { await removeFromWishlist(product.id); setWishlisted(false) }
      else            { await addToWishlist(product.id);    setWishlisted(true)  }
    } catch {}
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={close}
      />

      {/* Modal box */}
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto
          ${closing ? 'dialog-scale-out' : 'quick-view-in'}`}
      >
        {/* Close button */}
        <button
          onClick={close}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>

        <div className="grid md:grid-cols-2 gap-0">
          {/* Left: image */}
          <div className="bg-gray-50 rounded-tl-2xl rounded-bl-2xl p-4">
            <div className="aspect-square rounded-xl overflow-hidden bg-white relative">
              {images.length > 0 ? (
                <img src={images[currentImg]} alt={product.name} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="w-16 h-16 text-gray-200" />
                </div>
              )}
              {discountPct && (
                <span className="absolute top-3 left-3 bg-brand-red text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                  {discountPct}% OFF
                </span>
              )}
            </div>
            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImg(i)}
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition ${i === currentImg ? 'border-brand-purple' : 'border-gray-200'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: details */}
          <div className="p-5 flex flex-col">
            {/* Category */}
            {product.category && (
              <span className="inline-block text-xs font-medium text-brand-purple bg-brand-purple/10 px-2.5 py-1 rounded-full mb-2 self-start">
                {product.category}
              </span>
            )}

            <h2 className="text-lg font-bold text-gray-900 leading-snug">{product.name}</h2>

            {/* Price */}
            <div className="flex items-baseline gap-2 mt-3">
              <span className="text-2xl font-extrabold text-gray-900">{formatPrice(product.price)}</span>
              {discountPct && (
                <>
                  <span className="text-sm text-gray-400 line-through">{formatPrice(product.compare_price)}</span>
                  <span className="text-xs font-bold text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full">{discountPct}% off</span>
                </>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-sm text-gray-500 mt-3 line-clamp-3 leading-relaxed">{product.description}</p>
            )}

            {/* Shop name */}
            {shop.name && (
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                <Store className="w-3.5 h-3.5" />
                <span>{shop.name}</span>
              </div>
            )}

            <div className="flex-1" />

            {/* Quantity selector */}
            <div className="flex items-center gap-3 mt-4">
              <span className="text-sm font-medium text-gray-700">Qty</span>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="px-3 py-2 hover:bg-gray-50 transition"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-4 py-2 text-sm font-bold border-x border-gray-200">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => q + 1)}
                  className="px-3 py-2 hover:bg-gray-50 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleWishlist}
                className={`p-2.5 rounded-xl border transition flex-shrink-0 ${
                  wishlisted
                    ? 'bg-red-50 border-red-200 text-brand-red'
                    : 'border-gray-200 text-gray-500 hover:border-brand-red hover:text-brand-red'
                }`}
              >
                <Heart className={`w-4 h-4 ${wishlisted ? 'fill-current' : ''}`} />
              </button>
              <Link
                to={`/app/product/${product.id}`}
                onClick={close}
                className="flex-1 flex items-center justify-center gap-2 bg-brand-purple text-white py-2.5 rounded-xl text-sm font-bold hover:bg-brand-purple/90 transition"
              >
                <ExternalLink className="w-4 h-4" /> View Full Details
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
