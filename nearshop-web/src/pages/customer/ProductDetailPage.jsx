import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import toast from 'react-hot-toast'
import { getProduct, getSimilarProducts } from '../../api/products'
import { addToWishlist, removeFromWishlist } from '../../api/wishlists'
import { createReservation } from '../../api/reservations'
import { startHaggle } from '../../api/haggle'
import { trackEvent } from '../../api/analytics'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import Button from '../../components/ui/Button'

export default function ProductDetailPage() {
  const { productId } = useParams()
  const navigate = useNavigate()

  const [product, setProduct] = useState(null)
  const [similar, setSimilar] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [isHeld, setIsHeld] = useState(false)
  const [haggleSession, setHaggleSession] = useState(null)
  const [showHaggleModal, setShowHaggleModal] = useState(false)
  const [offerAmount, setOfferAmount] = useState('')
  const [currentImage, setCurrentImage] = useState(0)
  const [descExpanded, setDescExpanded] = useState(false)

  const fetchProduct = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await getProduct(productId)
      setProduct(data)
      trackEvent({ event_type: 'view', entity_type: 'product', entity_id: productId }).catch(() => {})
      try {
        const { data: simData } = await getSimilarProducts(productId)
        setSimilar(simData.items || simData || [])
      } catch {}
    } catch (err) {
      setError(err.message || 'Failed to load product')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (productId) fetchProduct()
  }, [productId])

  const handleWhatsApp = () => {
    const shop = product.shop || {}
    const phone = (shop.whatsapp || shop.phone || '').replace('+', '')
    const msg = encodeURIComponent(`Hi, I saw ${product.name} on NearShop — is it available?`)
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
    trackEvent({ event_type: 'inquiry', entity_type: 'product', entity_id: product.id }).catch(() => {})
  }

  const handleHold = async () => {
    try {
      await createReservation(product.id)
      toast.success('Reserved for 2 hours!')
      setIsHeld(true)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reserve')
    }
  }

  const handleStartHaggle = async () => {
    if (!offerAmount || isNaN(parseFloat(offerAmount))) {
      toast.error('Enter a valid offer amount')
      return
    }
    try {
      const { data } = await startHaggle({ product_id: product.id, offer_amount: parseFloat(offerAmount) })
      toast.success('Offer sent!')
      setHaggleSession(data)
      setShowHaggleModal(false)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send offer')
    }
  }

  const handleWishlistToggle = async () => {
    try {
      if (isWishlisted) {
        await removeFromWishlist(product.id)
        setIsWishlisted(false)
        toast.success('Removed from wishlist')
      } else {
        await addToWishlist(product.id)
        setIsWishlisted(true)
        toast.success('Added to wishlist')
      }
    } catch (err) {
      toast.error('Failed to update wishlist')
    }
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: product.name, url: window.location.href }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(window.location.href)
      toast.success('Link copied!')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-4">
        <EmptyState
          icon={ShoppingBag}
          title="Could not load product"
          message={error}
          action="Retry"
          onAction={fetchProduct}
        />
      </div>
    )
  }

  if (!product) return null

  const images = product.images?.length ? product.images : (product.image ? [product.image] : [])
  const shop = product.shop || {}
  const whatsappPhone = (shop.whatsapp || shop.phone || '').replace('+', '')
  const whatsappMsg = encodeURIComponent(`Hi, I saw ${product.name} on NearShop — is it available?`)
  const whatsappUrl = whatsappPhone ? `https://wa.me/${whatsappPhone}?text=${whatsappMsg}` : null

  const discountPct = product.compare_price > product.price
    ? Math.round((1 - product.price / product.compare_price) * 100)
    : null

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Image gallery */}
      <div className="relative h-80 bg-gray-100">
        {images.length > 0 ? (
          <img
            src={images[currentImage]}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="h-16 w-16 text-gray-300" />
          </div>
        )}

        {/* Back + share + heart */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-white/90 rounded-full shadow flex items-center justify-center text-gray-800 font-bold"
          >
            ←
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleShare}
              className="w-10 h-10 bg-white/90 rounded-full shadow flex items-center justify-center"
            >
              ↗
            </button>
            <button
              onClick={handleWishlistToggle}
              className="w-10 h-10 bg-white/90 rounded-full shadow flex items-center justify-center active:scale-110 transition-transform"
            >
              {isWishlisted ? '❤️' : '🤍'}
            </button>
          </div>
        </div>

        {/* Image dots */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentImage(i)}
                className={`h-2 rounded-full transition-all ${
                  i === currentImage ? 'bg-white w-4' : 'bg-white/50 w-2'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* White card overlapping image */}
      <div className="bg-white rounded-t-3xl -mt-8 relative z-10 px-4 pt-5 pb-32">
        {/* Category + AI badge */}
        <div className="flex items-center gap-2 mb-2">
          {product.category && (
            <span className="bg-brand-purple-light text-brand-purple text-xs font-medium px-2.5 py-1 rounded-full">
              {product.category}
            </span>
          )}
          {product.is_ai_listed && (
            <span className="bg-brand-amber-light text-brand-amber text-xs font-medium px-2.5 py-1 rounded-full">
              ✨ AI Listed
            </span>
          )}
        </div>

        {/* Product name */}
        <h1 className="text-lg font-semibold text-gray-900 leading-snug">{product.name}</h1>

        {/* Price */}
        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-2xl font-bold text-gray-900">₹{product.price}</span>
          {discountPct && (
            <>
              <span className="text-sm text-gray-400 line-through">₹{product.compare_price}</span>
              <span className="text-xs font-semibold bg-brand-green-light text-brand-green px-2 py-0.5 rounded-full">
                {discountPct}% off
              </span>
            </>
          )}
        </div>

        {/* Held banner */}
        {isHeld && (
          <div className="bg-brand-purple text-white rounded-2xl p-4 text-center mt-4">
            <div className="font-semibold">📌 Reserved for you!</div>
            <div className="text-sm opacity-80 mt-1">Held for 2 hours</div>
          </div>
        )}

        {/* Haggle sent banner */}
        {haggleSession && (
          <div className="bg-brand-green-light border border-brand-green/20 rounded-2xl p-3 text-center text-brand-green text-sm mt-4">
            ✅ Offer sent! Waiting for seller response.
          </div>
        )}

        <div className="border-t border-gray-100 my-4" />

        {/* Description */}
        {product.description && (
          <div className="mb-4">
            <p className={`text-sm text-gray-600 leading-relaxed ${descExpanded ? '' : 'line-clamp-3'}`}>
              {product.description}
            </p>
            <button
              onClick={() => setDescExpanded((v) => !v)}
              className="text-xs text-brand-purple font-medium mt-1"
            >
              {descExpanded ? 'Show less' : 'Read more'}
            </button>
          </div>
        )}

        {/* Tags */}
        {product.tags?.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
            {product.tags.map((tag) => (
              <span
                key={tag}
                className="flex-shrink-0 bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="border-t border-gray-100 my-4" />

        {/* Shop card */}
        {product.shop && (
          <div
            className="flex items-center gap-3 border border-gray-100 rounded-2xl p-3 mb-4 cursor-pointer active:bg-gray-50 transition-colors"
            onClick={() => navigate(`/app/shop/${product.shop.id}`)}
          >
            <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
              {product.shop.logo_url ? (
                <img src={product.shop.logo_url} alt={product.shop.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-gray-300" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">{product.shop.name}</p>
              {product.shop.address && (
                <p className="text-xs text-gray-500 truncate">{product.shop.address}</p>
              )}
              {product.shop.avg_rating != null && (
                <p className="text-xs text-gray-500 mt-0.5">⭐ {product.shop.avg_rating.toFixed(1)}</p>
              )}
            </div>
            <span className="text-gray-400 text-sm">›</span>
          </div>
        )}

        {/* Similar products */}
        {similar.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Similar Products</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {similar.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className="flex-shrink-0 w-36 bg-white rounded-2xl shadow-card overflow-hidden cursor-pointer active:scale-95 transition-transform"
                  onClick={() => navigate(`/app/product/${item.id}`)}
                >
                  <div className="h-28 bg-gray-100 overflow-hidden">
                    {item.images?.[0] ? (
                      <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="h-6 w-6 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                    <p className="text-xs font-bold text-gray-900 mt-0.5">₹{item.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 space-y-2 z-50">
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full h-12 bg-brand-green text-white rounded-xl font-semibold text-sm"
          >
            💬 Chat on WhatsApp
          </a>
        ) : (
          <button
            onClick={handleWhatsApp}
            className="flex items-center justify-center gap-2 w-full h-12 bg-brand-green text-white rounded-xl font-semibold text-sm"
          >
            💬 Chat on WhatsApp
          </button>
        )}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleHold}
            disabled={isHeld}
            className="h-11 bg-brand-purple-light text-brand-purple rounded-xl text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
          >
            📌 Hold for Me
          </button>
          <button
            onClick={() => setShowHaggleModal(true)}
            disabled={!!haggleSession}
            className="h-11 bg-brand-amber-light text-brand-amber rounded-xl text-xs font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
          >
            💰 Make Offer
          </button>
          <button
            onClick={handleWishlistToggle}
            className={`h-11 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 ${
              isWishlisted ? 'bg-brand-red text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isWishlisted ? '❤️' : '🤍'} {isWishlisted ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Haggle bottom sheet */}
      {showHaggleModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowHaggleModal(false)} />
          <div className="absolute inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl p-5">
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <h3 className="font-semibold text-lg text-gray-800 mb-1">Make an Offer</h3>
            <p className="text-sm text-gray-500 mb-4">Listed price: ₹{product.price}</p>
            <input
              type="number"
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              placeholder="Your offer amount"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
            />
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setShowHaggleModal(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleStartHaggle}>Send Offer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
