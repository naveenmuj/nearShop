import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { getShop, getShopProducts, followShop, unfollowShop } from '../../api/shops'
import { getShopReviews } from '../../api/reviews'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

export default function ShopDetailPage() {
  const { shopId } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  const [shop, setShop] = useState(null)
  const [products, setProducts] = useState([])
  const [reviews, setReviews] = useState([])
  const [shopLoading, setShopLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('Products')
  const [descExpanded, setDescExpanded] = useState(false)

  // Fetch shop info, products and reviews in parallel on mount
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
    if (!isAuthenticated) {
      navigate('/auth/login')
      return
    }
    setFollowLoading(true)
    try {
      if (shop.is_following) {
        await unfollowShop(shopId)
        setShop((prev) => ({ ...prev, is_following: false, followers_count: (prev.followers_count ?? 1) - 1 }))
      } else {
        await followShop(shopId)
        setShop((prev) => ({ ...prev, is_following: true, followers_count: (prev.followers_count ?? 0) + 1 }))
      }
    } catch {
      // Silently revert — server rejected the action
    } finally {
      setFollowLoading(false)
    }
  }

  if (shopLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error || !shop) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Shop not found"
        message={error ?? 'This shop does not exist or has been removed.'}
        action="Go back"
        onAction={() => navigate(-1)}
      />
    )
  }

  const distanceLabel = shop.distance_km != null
    ? (shop.distance_km < 1
        ? `${Math.round(shop.distance_km * 1000)}m`
        : `${shop.distance_km.toFixed(1)} km`)
    : shop.distance ?? null

  const whatsappPhone = (shop.whatsapp || shop.phone || '').replace('+', '')
  const whatsappUrl = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(`Hi, I found your shop on NearShop!`)}`
    : null

  const mapsQuery = encodeURIComponent(shop.address || shop.name || '')
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`

  return (
    <div className="bg-gray-50 min-h-screen pb-8">
      {/* Hero image */}
      <div className="relative h-56 bg-gray-200">
        {shop.cover_image ? (
          <img src={shop.cover_image} alt={shop.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="h-16 w-16 text-gray-300" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-800 font-bold"
        >
          ←
        </button>
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-xl font-bold text-white">{shop.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            {shop.category && (
              <span className="bg-white/20 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full">
                {shop.category}
              </span>
            )}
            {shop.is_verified && (
              <span className="bg-brand-green/20 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-full">
                ✓ Verified
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info card overlapping hero */}
      <div className="bg-white rounded-t-3xl -mt-6 relative z-10 px-4 pt-4 pb-2">
        {/* Rating + distance + open status */}
        <div className="flex items-center gap-3 text-sm text-gray-600 flex-wrap">
          {(shop.avg_rating ?? shop.rating) != null && (
            <span className="flex items-center gap-1">
              ⭐ {(shop.avg_rating ?? shop.rating).toFixed(1)}
              {shop.total_reviews != null && (
                <span className="text-gray-400">({shop.total_reviews})</span>
              )}
            </span>
          )}
          {distanceLabel && <span>📍 {distanceLabel}</span>}
          {shop.is_open != null && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${shop.is_open ? 'bg-brand-green-light text-brand-green' : 'bg-gray-100 text-gray-500'}`}>
              {shop.is_open ? 'Open' : 'Closed'}
            </span>
          )}
          {shop.followers_count != null && (
            <span className="text-gray-400 text-xs">{shop.followers_count.toLocaleString()} followers</span>
          )}
        </div>

        {/* Description with expand */}
        {shop.description && (
          <div className="mt-3">
            <p className={`text-sm text-gray-600 leading-relaxed ${descExpanded ? '' : 'line-clamp-2'}`}>
              {shop.description}
            </p>
            <button
              onClick={() => setDescExpanded((v) => !v)}
              className="text-xs text-brand-purple font-medium mt-1"
            >
              {descExpanded ? 'Show less' : 'Read more'}
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2 mt-4 mb-2">
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 py-3 bg-brand-green-light rounded-xl text-brand-green text-xs font-medium"
            >
              <span>💬</span>WhatsApp
            </a>
          ) : (
            <button className="flex flex-col items-center gap-1 py-3 bg-brand-green-light rounded-xl text-brand-green text-xs font-medium opacity-40 cursor-not-allowed">
              <span>💬</span>WhatsApp
            </button>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 py-3 bg-brand-blue-light rounded-xl text-brand-blue text-xs font-medium"
          >
            <span>📍</span>Directions
          </a>
          <button
            onClick={handleFollowToggle}
            disabled={followLoading}
            className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium transition-colors ${
              shop.is_following
                ? 'bg-brand-purple text-white'
                : 'bg-brand-purple-light text-brand-purple'
            }`}
          >
            <span>{shop.is_following ? '❤️' : '🤍'}</span>
            {shop.is_following ? 'Following' : 'Follow'}
          </button>
        </div>
      </div>

      {/* Tab pills */}
      <div className="flex gap-2 px-4 py-3 bg-white border-b border-gray-100">
        {['Products', 'Reviews', 'About'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 py-4 space-y-3">
        {/* Products tab */}
        {activeTab === 'Products' && (
          <>
            {productsLoading ? (
              <div className="flex justify-center py-10">
                <LoadingSpinner size="lg" />
              </div>
            ) : products.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">
                This shop has no products listed yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white rounded-2xl shadow-card overflow-hidden cursor-pointer active:scale-95 transition-transform"
                    onClick={() => navigate(`/app/product/${product.id}`)}
                  >
                    <div className="aspect-square bg-gray-100 overflow-hidden">
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ShoppingBag className="h-8 w-8 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-sm font-bold text-gray-900">₹{product.price}</span>
                        {product.compare_price > product.price && (
                          <span className="text-xs text-gray-400 line-through">₹{product.compare_price}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Reviews tab */}
        {activeTab === 'Reviews' && (
          <>
            {reviews.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No reviews yet.</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="bg-white rounded-2xl shadow-card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand-purple-light flex items-center justify-center text-brand-purple text-xs font-bold">
                          {(review.reviewer_name ?? review.user_name ?? 'C')?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-sm text-gray-800">
                          {review.reviewer_name ?? review.user_name ?? 'Customer'}
                        </span>
                      </div>
                      <div className="flex">{'⭐'.repeat(Math.min(review.rating ?? 0, 5))}</div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                    )}
                    {review.shop_reply && (
                      <div className="bg-gray-50 rounded-xl p-3 border-l-4 border-brand-purple">
                        <p className="text-xs text-brand-purple font-semibold mb-1">Shop Reply</p>
                        <p className="text-xs text-gray-600">{review.shop_reply}</p>
                      </div>
                    )}
                    {review.created_at && (
                      <p className="text-xs text-gray-400">
                        {new Date(review.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* About tab */}
        {activeTab === 'About' && (
          <div className="bg-white rounded-2xl shadow-card p-4 space-y-3">
            {shop.description && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">About</p>
                <p className="text-sm text-gray-700 leading-relaxed">{shop.description}</p>
              </div>
            )}
            {shop.address && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Address</p>
                <p className="text-sm text-gray-700">{shop.address}</p>
              </div>
            )}
            {(shop.phone || shop.whatsapp) && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Contact</p>
                <p className="text-sm text-gray-700">{shop.whatsapp || shop.phone}</p>
              </div>
            )}
            {shop.opening_hours && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Hours</p>
                <p className="text-sm text-gray-700">{shop.opening_hours}</p>
              </div>
            )}
            {shop.followers_count != null && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Followers</p>
                <p className="text-sm text-gray-700">{shop.followers_count.toLocaleString()}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
