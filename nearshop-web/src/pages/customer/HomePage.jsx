import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Store, Search, ChevronRight, Zap, ShoppingBag, Star, Truck } from 'lucide-react'
import { useLocation } from '../../hooks/useLocation'
import { useAuthStore } from '../../store/authStore'
import { getNearbyShops } from '../../api/shops'
import { getNearbyDeals } from '../../api/deals'
import { getStoriesFeed } from '../../api/stories'
import { getCategories } from '../../api/categories'
import { searchProducts } from '../../api/products'
import { getNearbyDeliverableShops } from '../../api/search'
import StoryCircle from '../../components/StoryCircle'
import EmptyState from '../../components/ui/EmptyState'
import ScrollReveal from '../../components/ui/ScrollReveal'
import RecentlyViewed from '../../components/RecentlyViewed'
import ShopCarousel from '../../components/ShopCarousel'
import ShopCard from '../../components/ShopCard'

const CATEGORY_ICONS = {
  food: '🍔', grocery: '🛒', pharmacy: '💊', electronics: '📱',
  clothing: '👕', beauty: '💄', restaurant: '🍽️', bakery: '🥐', home: '🏠', default: '🏪',
}

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

export default function HomePage() {
  const navigate = useNavigate()
  const { latitude, longitude, locationName, isLoading: locationLoading } = useLocation()
  const { isAuthenticated, user } = useAuthStore()

  const [shops, setShops] = useState([])
  const [deliveryShops, setDeliveryShops] = useState([])
  const [deals, setDeals] = useState([])
  const [stories, setStories] = useState([])
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!latitude || !longitude) return
    const fetchAll = async () => {
      setLoading(true)
      setError(null)
      try {
        const reqs = [
          getNearbyShops(latitude, longitude, { limit: 12 }),
          getNearbyDeals(latitude, longitude, { limit: 8 }),
          getCategories(),
          searchProducts({ per_page: 12 }),
          getNearbyDeliverableShops(latitude, longitude, 5, 10),
        ]
        if (isAuthenticated) reqs.push(getStoriesFeed())
        const [shopsRes, dealsRes, catsRes, prodsRes, deliveryRes, storiesRes] = await Promise.all(reqs)
        setShops(shopsRes.data.items ?? shopsRes.data ?? [])
        setDeals(dealsRes.data.items ?? dealsRes.data ?? [])
        setCategories(catsRes.data.items ?? catsRes.data ?? [])
        setProducts(prodsRes.data.items ?? prodsRes.data ?? [])
        setDeliveryShops(deliveryRes.data.shops ?? [])
        if (storiesRes) setStories(storiesRes.data.items ?? storiesRes.data ?? [])
      } catch (err) { setError(err.message || 'Failed to load') } finally { setLoading(false) }
    }
    fetchAll()
  }, [latitude, longitude, isAuthenticated])

  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
  const firstName = user?.name?.split(' ')[0] || 'there'

  return (
    <div className="space-y-8">
      {/* Hero / Greeting */}
      <ScrollReveal direction="up">
        <div className="bg-gradient-to-r from-brand-purple to-[#38BDF8] rounded-2xl p-6 lg:p-8 text-white">
          <p className="text-sm opacity-80">{greeting()},</p>
          <h1 className="text-2xl lg:text-3xl font-extrabold mt-1">{firstName} 👋</h1>
          <p className="text-sm opacity-70 mt-2 max-w-md">Discover amazing products and shops near you</p>
        </div>
      </ScrollReveal>

      {/* Stories (if any) */}
      {isAuthenticated && stories.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-1">
          {stories.map(story => (
            <div key={story.id ?? story.shop_id} className="flex-shrink-0 flex flex-col items-center gap-1.5">
              <div className="w-16 h-16 rounded-full ring-2 ring-brand-purple ring-offset-2 overflow-hidden">
                <StoryCircle story={story} onClick={() => {}} />
              </div>
              <span className="text-[10px] text-gray-500 font-medium truncate w-16 text-center">{story.shop_name ?? ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recently Viewed */}
      {isAuthenticated && <RecentlyViewed />}

      {/* Categories — desktop: row of cards, mobile: scroll */}
      {categories.length > 0 && (
        <ScrollReveal direction="up" delay={50}>
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Browse Categories</h2>
            <div className="flex gap-2 lg:gap-3 overflow-x-auto lg:overflow-visible lg:flex-wrap pb-1">
              {categories.map(cat => {
                const icon = CATEGORY_ICONS[String(cat.name).toLowerCase()] ?? CATEGORY_ICONS.default
                return (
                  <button key={cat.slug ?? cat.id} onClick={() => navigate(`/app/search?category=${cat.slug ?? cat.id}`)}
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-brand-purple hover:text-brand-purple hover:shadow-sm transition">
                    <span className="text-lg">{icon}</span> {cat.name}
                  </button>
                )
              })}
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* Live Deals */}
      {deals.length > 0 && (
        <ScrollReveal direction="up" delay={100}>
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-brand-red fill-brand-red" />
                <h2 className="text-lg font-bold text-gray-900">Live Deals</h2>
                <span className="w-2 h-2 bg-brand-red rounded-full animate-pulse" />
              </div>
              <button onClick={() => navigate('/app/deals')} className="flex items-center gap-1 text-sm font-semibold text-brand-purple hover:underline">
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {deals.map(deal => (
                <button key={deal.id} onClick={() => navigate('/app/deals')}
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all text-left group">
                  <div className="bg-gradient-to-br from-brand-red to-brand-coral p-3 lg:p-4">
                    <span className="text-white text-lg lg:text-xl font-extrabold">
                      {deal.discount_percent ? `${deal.discount_percent}% OFF` : '🔥 Deal'}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-800 line-clamp-2">{deal.title ?? deal.name}</p>
                    <p className="text-xs text-gray-400 mt-1 truncate">{deal.shop_name ?? ''}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* Shops That Deliver to You - Beautiful Carousel */}
      {deliveryShops.length > 0 && (
        <ScrollReveal direction="up" delay={140}>
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-green-500" />
                <h2 className="text-lg font-bold text-gray-900">Shops Delivering to You</h2>
              </div>
              <button onClick={() => navigate('/app/shops/nearby')} className="flex items-center gap-1 text-sm font-semibold text-brand-purple hover:underline">
                View all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <ShopCarousel
              shops={deliveryShops}
              loading={loading}
              distance_km_map={deliveryShops.reduce((acc, shop) => ({ ...acc, [shop.id]: shop.distance_km }), {})}
            />
          </section>
        </ScrollReveal>
      )}

      {/* Nearby Shops - Grid View */}
      <ScrollReveal direction="up" delay={150}>
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">All Nearby Shops</h2>
            <button onClick={() => navigate('/app/shops/map')} className="flex items-center gap-1 text-sm font-semibold text-brand-purple hover:underline">
              Map view <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {loading && <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{Array.from({length:8}).map((_,i) => <div key={i} className="bg-white rounded-xl h-48 skeleton-shimmer" />)}</div>}
          {!loading && shops.length === 0 && <EmptyState icon={Store} title="No shops nearby" message="There are no shops in your area yet." />}
          {!loading && shops.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
              {shops.map((shop, i) => (
                <ScrollReveal key={shop.id} direction="up" delay={i * 40}>
                  <ShopCard shop={shop} />
                </ScrollReveal>
              ))}
            </div>
          )}
        </section>
      </ScrollReveal>

      {/* Trending Products */}
      {products.length > 0 && (
        <ScrollReveal direction="up" delay={200}>
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Trending Products</h2>
              <button onClick={() => navigate('/app/search')} className="flex items-center gap-1 text-sm font-semibold text-brand-purple hover:underline">
                Browse all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-4">
              {products.map((product, i) => {
                const discount = product.compare_price && product.price && Number(product.compare_price) > Number(product.price) ? Math.round((1 - product.price / product.compare_price) * 100) : null
                return (
                  <ScrollReveal key={product.id} direction="up" delay={i * 30}>
                    <button onClick={() => navigate(`/app/product/${product.id}`)}
                      className="w-full bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 text-left group">
                      <div className="aspect-square bg-gray-50 relative overflow-hidden">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-10 h-10 text-gray-200" /></div>
                        )}
                        {discount && (
                          <span className="absolute top-2 left-2 bg-brand-red text-white text-[10px] font-bold px-2 py-0.5 rounded-lg">{discount}% OFF</span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">{product.name}</p>
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                          <span className="text-base font-bold text-gray-900">{formatPrice(product.price)}</span>
                          {product.compare_price && product.price && Number(product.compare_price) > Number(product.price) && (
                            <span className="text-xs text-gray-400 line-through">{formatPrice(product.compare_price)}</span>
                          )}
                        </div>
                        {product.shop_name && <p className="text-xs text-gray-400 mt-1 truncate">🏪 {product.shop_name}</p>}
                      </div>
                    </button>
                  </ScrollReveal>
                )
              })}
            </div>
          </section>
        </ScrollReveal>
      )}
    </div>
  )
}
