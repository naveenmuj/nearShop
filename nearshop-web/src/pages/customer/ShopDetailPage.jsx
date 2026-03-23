import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ShoppingBag, ArrowLeft, MapPin, Phone, Star, Users, Clock, Share2, Heart, MessageCircle, Navigation } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { getShop, getShopProducts, followShop, unfollowShop } from '../../api/shops'
import { getShopReviews } from '../../api/reviews'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

const TABS = ['Products', 'Reviews', 'About']

export default function ShopDetailPage() {
  const { shopId } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const tabBarRef = useRef(null)

  const [shop, setShop] = useState(null)
  const [products, setProducts] = useState([])
  const [reviews, setReviews] = useState([])
  const [shopLoading, setShopLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('Products')
  const [descExpanded, setDescExpanded] = useState(false)
  const [tabBarStuck, setTabBarStuck] = useState(false)

  useEffect(() => {
    if (!shopId) return
    setShopLoading(true)
    setProductsLoading(true)
    setError(null)

    getShop(shopId)
      .then(({ data }) => setShop(data))
      .catch((err) => setError(err.message || 'Failed to load shop'))
      .finally(() => setShopLoading(false))

    getShopProducts(shopId, { page: 1, per_page: 20 })
      .then(({ data }) => setProducts(data.items ?? data.products ?? data ?? []))
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false))

    getShopReviews(shopId)
      .then(({ data }) => setReviews(data.reviews ?? data.items ?? data ?? []))
      .catch(() => setReviews([]))
  }, [shopId])

  const handleFollowToggle = async () => {
    if (!isAuthenticated) { navigate('/auth/login'); return }
    setFollowLoading(true)
    try {
      if (shop.is_following) {
        await unfollowShop(shopId)
        setShop(p => ({ ...p, is_following: false, followers_count: (p.followers_count ?? 1) - 1 }))
      } else {
        await followShop(shopId)
        setShop(p => ({ ...p, is_following: true, followers_count: (p.followers_count ?? 0) + 1 }))
      }
    } catch { /* silently revert */ } finally { setFollowLoading(false) }
  }

  if (shopLoading) {
    return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>
  }
  if (error || !shop) {
    return (
      <EmptyState icon={ShoppingBag} title="Shop not found"
        message={error ?? 'This shop does not exist or has been removed.'}
        action="Go back" onAction={() => navigate(-1)} />
    )
  }

  const distanceLabel = shop.distance_km != null
    ? (shop.distance_km < 1 ? `${Math.round(shop.distance_km * 1000)}m` : `${Number(shop.distance_km).toFixed(1)} km`)
    : shop.distance ?? null

  const whatsappPhone = (shop.whatsapp || shop.phone || '').replace('+', '')
  const whatsappUrl = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent('Hi, I found your shop on NearShop!')}`
    : null
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address || shop.name || '')}`

  const avgRating = Number(shop.avg_rating ?? shop.rating ?? 0)
  const hasRating = avgRating > 0

  return (
    <div className="bg-gray-50 min-h-screen pb-24">
      {/* ── Hero ── */}
      <div className="relative h-64 bg-gradient-to-br from-[#5B2BE7]/20 to-[#7F77DD]/20">
        {shop.cover_image ? (
          <img src={shop.cover_image} alt={shop.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#5B2BE7]/10 to-[#38BDF8]/10 flex items-center justify-center">
            <ShoppingBag className="w-20 h-20 text-[#7F77DD]/40" />
          </div>
        )}
        {/* gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center hover:bg-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-800" />
        </button>

        {/* Share button */}
        <button className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center hover:bg-white transition-colors">
          <Share2 className="w-4 h-4 text-gray-800" />
        </button>

        {/* Shop name overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <div className="flex items-end gap-3">
            {/* Shop logo circle */}
            <div className="w-14 h-14 rounded-2xl bg-white shadow-lg flex items-center justify-center flex-shrink-0 border-2 border-white overflow-hidden">
              {shop.logo || shop.image ? (
                <img src={shop.logo ?? shop.image} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl">🏪</span>
              )}
            </div>
            <div className="pb-1">
              <h1 className="text-xl font-extrabold text-white leading-tight">{shop.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {shop.category && (
                  <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-2.5 py-0.5 rounded-full font-medium">
                    {shop.category}
                  </span>
                )}
                {shop.is_verified && (
                  <span className="bg-[#1D9E75]/80 text-white text-xs px-2.5 py-0.5 rounded-full font-semibold">
                    ✓ Verified
                  </span>
                )}
                {shop.is_open != null && (
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${shop.is_open ? 'bg-[#1D9E75]/80 text-white' : 'bg-black/40 text-white/80'}`}>
                    {shop.is_open ? '● Open' : '● Closed'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info card ── */}
      <div className="bg-white rounded-t-3xl -mt-4 relative z-10 px-4 pt-5 pb-4 shadow-sm">
        {/* Stats row */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          {hasRating && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="text-sm font-bold text-amber-700">{avgRating.toFixed(1)}</span>
              {shop.total_reviews != null && (
                <span className="text-xs text-amber-500">({shop.total_reviews})</span>
              )}
            </div>
          )}
          {distanceLabel && (
            <div className="flex items-center gap-1.5 text-gray-500">
              <MapPin className="w-3.5 h-3.5 text-[#5B2BE7]" />
              <span className="text-sm font-medium">{distanceLabel}</span>
            </div>
          )}
          {shop.followers_count != null && (
            <div className="flex items-center gap-1.5 text-gray-500">
              <Users className="w-3.5 h-3.5 text-[#5B2BE7]" />
              <span className="text-sm font-medium">{Number(shop.followers_count || 0).toLocaleString()} followers</span>
            </div>
          )}
        </div>

        {/* Description */}
        {shop.description && (
          <div className="mb-4">
            <p className={`text-sm text-gray-600 leading-relaxed ${descExpanded ? '' : 'line-clamp-2'}`}>
              {shop.description}
            </p>
            <button
              onClick={() => setDescExpanded(v => !v)}
              className="text-xs text-[#5B2BE7] font-semibold mt-1 hover:underline"
            >
              {descExpanded ? 'Show less' : 'Read more'}
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2.5">
          {whatsappUrl ? (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 py-3.5 bg-[#25D366]/10 border border-[#25D366]/20 rounded-2xl text-[#128C7E] hover:bg-[#25D366]/20 transition-colors active:scale-[0.97]">
              <MessageCircle className="w-5 h-5" />
              <span className="text-xs font-semibold">WhatsApp</span>
            </a>
          ) : (
            <div className="flex flex-col items-center gap-1.5 py-3.5 bg-gray-100 rounded-2xl text-gray-300">
              <MessageCircle className="w-5 h-5" />
              <span className="text-xs font-semibold">WhatsApp</span>
            </div>
          )}

          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
            className="flex flex-col items-center gap-1.5 py-3.5 bg-blue-50 border border-blue-100 rounded-2xl text-blue-600 hover:bg-blue-100 transition-colors active:scale-[0.97]">
            <Navigation className="w-5 h-5" />
            <span className="text-xs font-semibold">Directions</span>
          </a>

          <button
            onClick={handleFollowToggle}
            disabled={followLoading}
            className={`flex flex-col items-center gap-1.5 py-3.5 rounded-2xl text-xs font-semibold transition-all active:scale-[0.97] border ${
              shop.is_following
                ? 'bg-[#5B2BE7] border-[#5B2BE7] text-white shadow-md shadow-purple-200'
                : 'bg-[#5B2BE7]/8 border-[#5B2BE7]/20 text-[#5B2BE7] hover:bg-[#5B2BE7]/15'
            } disabled:opacity-60`}
          >
            <Heart className={`w-5 h-5 ${shop.is_following ? 'fill-white' : ''}`} />
            <span>{followLoading ? '...' : shop.is_following ? 'Following' : 'Follow'}</span>
          </button>
        </div>
      </div>

      {/* ── Sticky Tab bar ── */}
      <div
        ref={tabBarRef}
        className="sticky top-0 z-20 bg-white border-b border-gray-100 shadow-sm"
      >
        <div className="flex">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 relative py-3.5 text-sm font-semibold transition-colors ${
                activeTab === tab ? 'text-[#5B2BE7]' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
              {/* Underline indicator */}
              <span className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all duration-300 ${
                activeTab === tab ? 'w-8 bg-[#5B2BE7]' : 'w-0 bg-transparent'
              }`} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="px-4 py-4">

        {/* Products */}
        {activeTab === 'Products' && (
          <div>
            {productsLoading ? (
              <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                  <ShoppingBag className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-base font-semibold text-gray-700">No products yet</p>
                <p className="text-sm text-gray-400 mt-1">This shop hasn't listed any products.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
                {products.map(product => {
                  const discount = product.compare_price && product.price && product.compare_price > product.price
                    ? Math.round((1 - Number(product.price) / Number(product.compare_price)) * 100)
                    : null
                  return (
                    <button
                      key={product.id}
                      onClick={() => navigate(`/app/product/${product.id}`)}
                      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.97] text-left"
                    >
                      <div className="relative aspect-square bg-gray-50 overflow-hidden">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="w-10 h-10 text-gray-200" />
                          </div>
                        )}
                        {discount && (
                          <div className="absolute top-2 left-2 bg-[#E24B4A] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {discount}% off
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight">{product.name}</p>
                        <div className="flex items-baseline justify-between mt-2">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-base font-bold text-gray-900">₹{product.price}</span>
                            {product.compare_price && product.price && Number(product.compare_price) > Number(product.price) && (
                              <span className="text-xs text-gray-400 line-through">₹{product.compare_price}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Reviews */}
        {activeTab === 'Reviews' && (
          <div>
            {/* Summary */}
            {hasRating && reviews.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4 flex items-center gap-4">
                <div className="text-center">
                  <p className="text-4xl font-extrabold text-gray-900">{avgRating.toFixed(1)}</p>
                  <div className="flex items-center gap-0.5 justify-center mt-1">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200 fill-gray-200'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{reviews.length} reviews</p>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5,4,3,2,1].map(star => {
                    const count = reviews.filter(r => Math.round(r.rating ?? 0) === star).length
                    const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                    return (
                      <div key={star} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-3 text-right">{star}</span>
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0" />
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 w-4 text-right">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {reviews.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
                  <Star className="w-8 h-8 text-amber-300" />
                </div>
                <p className="text-base font-semibold text-gray-700">No reviews yet</p>
                <p className="text-sm text-gray-400 mt-1">Be the first to leave a review!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map(review => {
                  const name = review.reviewer_name ?? review.user_name ?? 'Customer'
                  const stars = Math.min(Math.round(review.rating ?? 0), 5)
                  const initial = name[0].toUpperCase()
                  return (
                    <div key={review.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5B2BE7] to-[#7F77DD] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {initial}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{name}</p>
                            {review.created_at && (
                              <p className="text-xs text-gray-400">
                                {new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 bg-amber-50 rounded-lg px-2 py-1">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span className="text-xs font-bold text-amber-600 ml-0.5">{stars}</span>
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                      )}
                      {review.shop_reply && (
                        <div className="mt-3 bg-[#5B2BE7]/5 border border-[#5B2BE7]/10 rounded-xl p-3">
                          <p className="text-xs font-bold text-[#5B2BE7] mb-1">🏪 Shop Reply</p>
                          <p className="text-xs text-gray-600 leading-relaxed">{review.shop_reply}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* About */}
        {activeTab === 'About' && (
          <div className="space-y-3">
            {[
              shop.description && { icon: '📝', label: 'About', value: shop.description },
              shop.address && { icon: '📍', label: 'Address', value: shop.address },
              (shop.phone || shop.whatsapp) && { icon: '📞', label: 'Contact', value: shop.whatsapp || shop.phone },
              shop.opening_hours && { icon: '🕐', label: 'Hours', value: shop.opening_hours },
              shop.followers_count != null && { icon: '👥', label: 'Followers', value: `${Number(shop.followers_count || 0).toLocaleString()} followers` },
            ].filter(Boolean).map(({ icon, label, value }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3">
                <div className="w-9 h-9 bg-[#5B2BE7]/8 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
                  {icon}
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{value}</p>
                </div>
              </div>
            ))}

            {!shop.description && !shop.address && !shop.phone && !shop.whatsapp && !shop.opening_hours && (
              <div className="flex flex-col items-center py-16 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                  <span className="text-3xl">🏪</span>
                </div>
                <p className="text-base font-semibold text-gray-700">No info available</p>
                <p className="text-sm text-gray-400 mt-1">This shop hasn't added details yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
