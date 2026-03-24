import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ShoppingBag, Share2, Lock, MessageSquare, ChevronRight, Star, MapPin, Store } from 'lucide-react'
import toast from 'react-hot-toast'
import { getProduct, getSimilarProducts } from '../../api/products'
import { createReservation } from '../../api/reservations'
import { startHaggle } from '../../api/haggle'
import { trackEvent } from '../../api/analytics'
import { trackView } from '../../api/engagement'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import WishlistHeart from '../../components/WishlistHeart'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

export default function ProductDetailPage() {
  const { productId } = useParams()
  const navigate = useNavigate()

  const [product, setProduct] = useState(null)
  const [similar, setSimilar] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isHeld, setIsHeld] = useState(false)
  const [haggleSession, setHaggleSession] = useState(null)
  const [showHaggleModal, setShowHaggleModal] = useState(false)
  const [offerAmount, setOfferAmount] = useState('')
  const [currentImage, setCurrentImage] = useState(0)
  const [descExpanded, setDescExpanded] = useState(false)

  const fetchProduct = async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await getProduct(productId)
      setProduct(data)
      trackEvent({ event_type: 'view', entity_type: 'product', entity_id: productId }).catch(() => {})
      trackView(productId).catch(() => {})
      try { const { data: simData } = await getSimilarProducts(productId); setSimilar(simData.items || simData || []) } catch {}
    } catch (err) { setError(err.message || 'Failed to load product') } finally { setLoading(false) }
  }

  useEffect(() => { if (productId) fetchProduct() }, [productId])

  const handleWhatsApp = () => {
    const shop = product.shop || {}
    const phone = (shop.whatsapp || shop.phone || '').replace('+', '')
    const msg = encodeURIComponent(`Hi, I saw ${product.name} on NearShop — is it available?`)
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank')
    trackEvent({ event_type: 'inquiry', entity_type: 'product', entity_id: product.id }).catch(() => {})
  }

  const handleHold = async () => {
    try { await createReservation(product.id); toast.success('Reserved for 2 hours!'); setIsHeld(true) }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed to reserve') }
  }

  const handleStartHaggle = async () => {
    if (!offerAmount || isNaN(parseFloat(offerAmount))) { toast.error('Enter a valid offer amount'); return }
    try { const { data } = await startHaggle({ product_id: product.id, offer_amount: parseFloat(offerAmount) }); toast.success('Offer sent!'); setHaggleSession(data); setShowHaggleModal(false) }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed to send offer') }
  }

  const handleShare = () => {
    if (navigator.share) navigator.share({ title: product.name, url: window.location.href }).catch(() => {})
    else { navigator.clipboard?.writeText(window.location.href); toast.success('Link copied!') }
  }

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>
  if (error) return <EmptyState icon={ShoppingBag} title="Could not load product" message={error} action="Retry" onAction={fetchProduct} />
  if (!product) return null

  const images = product.images?.length ? product.images : (product.image ? [product.image] : [])
  const shop = product.shop || {}
  const discountPct = product.compare_price && product.price && Number(product.compare_price) > Number(product.price) ? Math.round((1 - product.price / product.compare_price) * 100) : null

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="hidden md:flex items-center gap-2 text-sm text-gray-400 mb-4">
        <Link to="/app/home" className="hover:text-brand-purple transition">Home</Link>
        <span>/</span>
        {product.category && <><Link to={`/app/search?category=${product.category}`} className="hover:text-brand-purple transition">{product.category}</Link><span>/</span></>}
        <span className="text-gray-600 truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Two-column layout on desktop */}
      <div className="lg:flex lg:gap-8">
        {/* LEFT: Image gallery */}
        <div className="lg:w-1/2 lg:sticky lg:top-24 lg:self-start">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="aspect-square bg-gray-50 relative">
              {images.length > 0 ? (
                <img src={images[currentImage]} alt={product.name} className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="h-20 w-20 text-gray-200" /></div>
              )}
              {discountPct && <span className="absolute top-4 left-4 bg-brand-red text-white text-sm font-bold px-3 py-1 rounded-lg">{discountPct}% OFF</span>}
            </div>
            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 p-3 border-t border-gray-100">
                {images.map((img, i) => (
                  <button key={i} onClick={() => setCurrentImage(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 flex-shrink-0 transition ${i === currentImage ? 'border-brand-purple' : 'border-gray-200 hover:border-gray-300'}`}>
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Product details */}
        <div className="lg:w-1/2 mt-4 lg:mt-0">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 lg:p-6">
            {/* Badges */}
            <div className="flex items-center gap-2 mb-3">
              {product.category && <span className="bg-brand-purple-light text-brand-purple text-xs font-medium px-2.5 py-1 rounded-full">{product.category}</span>}
              {product.ai_generated && <span className="bg-brand-amber-light text-brand-amber text-xs font-medium px-2.5 py-1 rounded-full">AI Listed</span>}
            </div>

            {/* Name */}
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 leading-snug">{product.name}</h1>

            {/* Rating */}
            {product.view_count > 0 && <p className="text-xs text-gray-400 mt-1">{product.view_count} views</p>}

            {/* Price */}
            <div className="flex items-baseline gap-3 mt-4">
              <span className="text-3xl font-extrabold text-gray-900">{formatPrice(product.price)}</span>
              {discountPct && (
                <>
                  <span className="text-lg text-gray-400 line-through">{formatPrice(product.compare_price)}</span>
                  <span className="text-sm font-semibold bg-brand-green-light text-brand-green px-2.5 py-0.5 rounded-full">{discountPct}% off</span>
                </>
              )}
            </div>

            {/* Status banners */}
            {isHeld && <div className="bg-brand-purple text-white rounded-xl p-3 text-center mt-4 text-sm font-semibold">Reserved for you! (2 hours)</div>}
            {haggleSession && <div className="bg-brand-green-light border border-brand-green/20 rounded-xl p-3 text-center text-brand-green text-sm mt-4">Offer sent! Waiting for seller.</div>}

            <div className="border-t border-gray-100 my-5" />

            {/* Attributes */}
            {product.attributes && Object.keys(product.attributes).length > 0 && (
              <div className="space-y-2 mb-5">
                {Object.entries(product.attributes).map(([k, v]) => (
                  <div key={k} className="flex items-center text-sm">
                    <span className="text-gray-500 w-24 capitalize">{k}</span>
                    <span className="text-gray-800 font-medium">{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Shop card */}
            {shop.name && (
              <button onClick={() => navigate(`/app/shop/${shop.id}`)}
                className="w-full flex items-center gap-3 border border-gray-200 rounded-xl p-3 mb-5 hover:border-brand-purple/30 transition text-left">
                <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {shop.logo_url ? <img src={shop.logo_url} alt="" className="w-full h-full object-cover" /> : <Store className="w-5 h-5 text-gray-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{shop.name}</p>
                  {shop.address && <p className="text-xs text-gray-500 truncate flex items-center gap-1"><MapPin className="w-3 h-3" />{shop.address}</p>}
                  {shop.avg_rating > 0 && <p className="text-xs text-amber-600 mt-0.5">⭐ {Number(shop.avg_rating).toFixed(1)}</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </button>
            )}

            {/* Action buttons */}
            <div className="space-y-2">
              <button onClick={handleWhatsApp} className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-green-700 transition">
                <MessageSquare className="w-4 h-4" /> Chat on WhatsApp
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleHold} disabled={isHeld}
                  className="flex items-center justify-center gap-2 bg-brand-purple text-white py-3 rounded-xl text-sm font-bold hover:bg-brand-purple-dark transition disabled:opacity-50">
                  <Lock className="w-4 h-4" /> {isHeld ? 'Reserved' : 'Hold for Me'}
                </button>
                <button onClick={() => setShowHaggleModal(true)}
                  className="flex items-center justify-center gap-2 border-2 border-brand-purple text-brand-purple py-3 rounded-xl text-sm font-bold hover:bg-brand-purple-light transition">
                  Make Offer
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center justify-center border border-gray-200 rounded-xl py-2.5">
                  <WishlistHeart
                    productId={product.id}
                    initialWishlisted={product.is_wishlisted ?? false}
                    size="md"
                  />
                  <span className="text-sm font-medium text-gray-600 ml-1">Wishlist</span>
                </div>
                <button onClick={handleShare}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:border-brand-purple hover:text-brand-purple transition">
                  <Share2 className="w-4 h-4" /> Share
                </button>
              </div>
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 mt-4">
              <h3 className="text-sm font-bold text-gray-900 mb-2">Description</h3>
              <p className={`text-sm text-gray-600 leading-relaxed ${descExpanded ? '' : 'line-clamp-4'}`}>{product.description}</p>
              <button onClick={() => setDescExpanded(v => !v)} className="text-xs text-brand-purple font-medium mt-2">
                {descExpanded ? 'Show less' : 'Read more'}
              </button>
            </div>
          )}

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {product.tags.map(tag => <span key={tag} className="bg-gray-100 text-gray-600 text-xs px-3 py-1.5 rounded-lg">#{tag}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* Similar products */}
      {similar.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Similar Products</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {similar.map(p => (
              <button key={p.id} onClick={() => navigate(`/app/product/${p.id}`)}
                className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all text-left group">
                <div className="aspect-square bg-gray-50 overflow-hidden">
                  {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-8 h-8 text-gray-200" /></div>}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2">{p.name}</p>
                  <p className="text-sm font-bold text-gray-900 mt-1">{formatPrice(p.price)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Haggle modal */}
      {showHaggleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowHaggleModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Make an Offer</h3>
            <p className="text-sm text-gray-500 mb-4">Current price: {formatPrice(product.price)}</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg font-bold">₹</span>
              <input type="number" value={offerAmount} onChange={e => setOfferAmount(e.target.value)} autoFocus
                className="w-full h-12 pl-8 pr-4 border-2 border-gray-200 rounded-xl text-lg font-bold outline-none focus:border-brand-purple transition" placeholder="Your offer" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowHaggleModal(false)} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={handleStartHaggle} className="flex-1 py-3 bg-brand-purple text-white rounded-xl text-sm font-bold hover:bg-brand-purple-dark transition">Send Offer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
