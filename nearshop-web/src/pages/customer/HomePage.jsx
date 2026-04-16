import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Store, Search, ChevronRight, Zap, ShoppingBag, Star, Truck, TrendingUp, Sparkles, Clock } from 'lucide-react'
import { useLocation } from '../../hooks/useLocation'
import { useAuthStore } from '../../store/authStore'
import { getNearbyShops } from '../../api/shops'
import { getNearbyDeals } from '../../api/deals'
import { getStoriesFeed } from '../../api/stories'
import { getCategories } from '../../api/categories'
import { searchProducts } from '../../api/products'
import { getNearbyDeliverableShops, getSearchHistory } from '../../api/search'
import { getTrendingProducts, getCFRecommendations, getRecommendations as getAIRecommendations } from '../../api/ai'
import StoryCircle from '../../components/StoryCircle'
import EmptyState from '../../components/ui/EmptyState'
import ScrollReveal from '../../components/ui/ScrollReveal'
import RecentlyViewed from '../../components/RecentlyViewed'
import ShopCarousel from '../../components/ShopCarousel'
import ShopCard from '../../components/ShopCard'
import { PageTransition } from '../../components/ui/PageTransition'
import { SkeletonLoader } from '../../components/ui/SkeletonLoader'
import { getRankingReasonLabel, getRankingReasonTone } from '../../utils/ranking'
import { rankingSearchParams, trackRankingClick, trackRankingImpressions } from '../../utils/rankingTracking'

const CATEGORY_ICONS = {
  food: '🍔', grocery: '🛒', pharmacy: '💊', electronics: '📱',
  clothing: '👕', beauty: '💄', restaurant: '🍽️', bakery: '🥐', home: '🏠', default: '🏪',
}

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

export default function HomePage() {
  const navigate = useNavigate()
  const { latitude, longitude } = useLocation()
  const { isAuthenticated, user } = useAuthStore()

  const [shops, setShops] = useState([])
  const [deliveryShops, setDeliveryShops] = useState([])
  const [deals, setDeals] = useState([])
  const [stories, setStories] = useState([])
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [trending, setTrending] = useState([])
  const [cfRecs, setCfRecs] = useState([])
  const [forYouRecs, setForYouRecs] = useState([])
  const [searchHistory, setSearchHistory] = useState([])
  const [loading, setLoading] = useState(false)

  const mapAIProducts = (items = []) =>
    items.map((item) => ({
      ...item,
      type: 'product',
      image_url: item.images?.[0] ?? null,
      reason: item.reason ?? 'ai_match',
    }))

  useEffect(() => {
    if (!latitude || !longitude) return
    const fetchAll = async () => {
      setLoading(true)
      try {
        const reqs = [
          getNearbyShops(latitude, longitude, { limit: 12 }),
          getNearbyDeals(latitude, longitude, { limit: 8 }),
          getCategories(),
          searchProducts({ per_page: 12 }),
          getNearbyDeliverableShops(latitude, longitude, 5, 10),
        ]
        reqs.push(getTrendingProducts(latitude, longitude, { limit: 12 }))
        if (isAuthenticated) {
          reqs.push(getStoriesFeed())
          reqs.push(getCFRecommendations(latitude, longitude, { limit: 12 }))
          reqs.push(getAIRecommendations({ lat: latitude, lng: longitude, limit: 12 }))
          reqs.push(getSearchHistory(5))
        }
        const results = await Promise.allSettled(reqs)
        const val = (r) => r.status === 'fulfilled' ? r.value : null
        const shopsRes = val(results[0])
        const dealsRes = val(results[1])
        const catsRes = val(results[2])
        const prodsRes = val(results[3])
        const deliveryRes = val(results[4])
        const trendingRes = val(results[5])
        const storiesRes = isAuthenticated ? val(results[6]) : null
        const cfRes = isAuthenticated ? val(results[7]) : null
        const forYouRes = isAuthenticated ? val(results[8]) : null
        const historyRes = isAuthenticated ? val(results[9]) : null
        if (shopsRes) setShops(shopsRes.data.items ?? shopsRes.data ?? [])
        if (dealsRes) setDeals(dealsRes.data.items ?? dealsRes.data ?? [])
        if (catsRes) setCategories(catsRes.data.items ?? catsRes.data ?? [])
        if (prodsRes) setProducts(prodsRes.data.items ?? prodsRes.data ?? [])
        if (deliveryRes) setDeliveryShops(deliveryRes.data.shops ?? [])
        if (trendingRes) setTrending(trendingRes.data?.products ?? [])
        if (storiesRes) setStories(storiesRes.data.items ?? storiesRes.data ?? [])
        if (cfRes) setCfRecs(cfRes.data?.products ?? [])
        if (forYouRes) setForYouRecs(mapAIProducts(forYouRes.data?.products ?? []))
        if (historyRes) setSearchHistory(historyRes.data?.history ?? [])
      } catch {
        // Keep the home surface resilient even when one of the optional feeds fails.
      } finally { setLoading(false) }
    }
    fetchAll()
  }, [latitude, longitude, isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && forYouRecs.length > 0) {
      trackRankingImpressions(forYouRecs, {
        ranking_surface: 'content_recommendations',
        source_screen: 'home_for_you',
      })
    }
  }, [isAuthenticated, forYouRecs])

  useEffect(() => {
    if (isAuthenticated && cfRecs.length > 0) {
      trackRankingImpressions(cfRecs, {
        ranking_surface: 'collaborative_recommendations',
        source_screen: 'home_collaborative',
      })
    }
  }, [isAuthenticated, cfRecs])

  useEffect(() => {
    if (trending.length > 0) {
      trackRankingImpressions(trending, {
        ranking_surface: 'home_feed',
        source_screen: 'home_trending',
      })
    }
  }, [trending])

  const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening' }
  const firstName = user?.name?.split(' ')[0] || 'there'

  return (
    <PageTransition>
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

      {/* For You - Personalized Recommendations */}
      {isAuthenticated && forYouRecs.length > 0 && (
        <ScrollReveal direction="up" delay={30}>
          <section className="bg-gradient-to-r from-purple-50 to-pink-50 -mx-4 px-4 py-5 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-brand-purple to-pink-500 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">For You</h2>
                  <p className="text-xs text-gray-500">Based on your preferences</p>
                </div>
              </div>
              <button onClick={() => navigate('/app/search')} className="text-brand-purple text-sm font-medium flex items-center gap-1 hover:underline">
                See all <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {forYouRecs.map((item, idx) => (
                <div key={`${item.type}-${item.id}-${idx}`} 
                  onClick={() => item.type === 'shop' ? navigate(`/app/shop/${item.id}`) : (() => {
                    trackRankingClick(item, {
                      ranking_surface: 'content_recommendations',
                      source_screen: 'home_for_you',
                      position: idx + 1,
                    })
                    navigate(`/app/product/${item.id}${rankingSearchParams({
                      ranking_surface: 'content_recommendations',
                      source_screen: 'home_for_you',
                      ranking_reason: item.reason,
                      position: idx + 1,
                    })}`)
                  })()}
                  className="flex-shrink-0 w-[140px] bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition group">
                  <div className="relative h-24 bg-gray-100">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        {item.type === 'shop' ? <Store className="w-8 h-8" /> : <ShoppingBag className="w-8 h-8" />}
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                        item.type === 'shop' ? 'bg-blue-100 text-blue-700 border-blue-200' : getRankingReasonTone(item.reason)
                      }`}>
                        {item.type === 'shop' ? 'Shop' : getRankingReasonLabel(item.reason)}
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5">
                    <p className="font-medium text-gray-900 text-sm truncate">{item.name}</p>
                    {item.price && <p className="text-brand-purple font-bold text-sm mt-0.5">₹{item.price}</p>}
                    {item.shop_name && <p className="text-xs text-gray-500 truncate mt-0.5">{item.shop_name}</p>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* Recent Searches */}
      {isAuthenticated && searchHistory.length > 0 && (
        <ScrollReveal direction="up" delay={40}>
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <h2 className="text-base font-semibold text-gray-700">Recent Searches</h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {searchHistory.map((query, idx) => (
                <button key={idx} onClick={() => navigate(`/app/search?q=${encodeURIComponent(query)}`)}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:border-brand-purple hover:text-brand-purple transition flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  {query}
                </button>
              ))}
            </div>
          </section>
        </ScrollReveal>
      )}

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
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-brand-purple hover:text-brand-purple hover:shadow-sm transition hover-scale hover-lift">
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
          {loading && <SkeletonLoader type="shop" count={4} />}
          {!loading && shops.length === 0 && <EmptyState icon={Store} title="No shops nearby" message="There are no shops in your area yet." />}
          {!loading && shops.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4 stagger-list">
              {shops.map((shop, i) => (
                <div key={shop.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
                  <ScrollReveal direction="up" delay={i * 40}>
                    <ShopCard shop={shop} />
                  </ScrollReveal>
                </div>
              ))}
            </div>
          )}
        </section>
      </ScrollReveal>

      {/* AI Trending Products (real trending from events) */}
      {trending.length > 0 && (
        <ScrollReveal direction="up" delay={180}>
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-bold text-gray-900">Trending Near You</h2>
                <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">LIVE</span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-4">
              {trending.map((product, i) => {
                const discount = product.compare_price && product.price && Number(product.compare_price) > Number(product.price) ? Math.round((1 - product.price / product.compare_price) * 100) : null
                return (
                  <ScrollReveal key={product.id} direction="up" delay={i * 30}>
                    <button onClick={() => {
                      trackRankingClick(product, {
                        ranking_surface: 'home_feed',
                        source_screen: 'home_trending',
                        position: i + 1,
                      })
                      navigate(`/app/product/${product.id}${rankingSearchParams({
                        ranking_surface: 'home_feed',
                        source_screen: 'home_trending',
                        ranking_reason: product.reason || product.trend_label || 'trending',
                        position: i + 1,
                      })}`)
                    }}
                      className="w-full bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 text-left group">
                      <div className="aspect-square bg-gray-50 relative overflow-hidden">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-10 h-10 text-gray-200" /></div>
                        )}
                        {discount && <span className="absolute top-2 left-2 bg-brand-red text-white text-[10px] font-bold px-2 py-0.5 rounded-lg">{discount}% OFF</span>}
                        <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg">{product.trend_label}</span>
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">{product.name}</p>
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                          <span className="text-base font-bold text-gray-900">{formatPrice(product.price)}</span>
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

      {/* Recommended For You (Collaborative Filtering) */}
      {cfRecs.length > 0 && (
        <ScrollReveal direction="up" delay={190}>
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                <h2 className="text-lg font-bold text-gray-900">Recommended For You</h2>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-4">
              {cfRecs.map((product, i) => {
                const discount = product.compare_price && product.price && Number(product.compare_price) > Number(product.price) ? Math.round((1 - product.price / product.compare_price) * 100) : null
                return (
                  <ScrollReveal key={product.id} direction="up" delay={i * 30}>
                    <button onClick={() => {
                      trackRankingClick(product, {
                        ranking_surface: 'collaborative_recommendations',
                        source_screen: 'home_collaborative',
                        position: i + 1,
                      })
                      navigate(`/app/product/${product.id}${rankingSearchParams({
                        ranking_surface: 'collaborative_recommendations',
                        source_screen: 'home_collaborative',
                        ranking_reason: product.reason,
                        position: i + 1,
                      })}`)
                    }}
                      className="w-full bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 text-left group">
                      <div className="aspect-square bg-gray-50 relative overflow-hidden">
                        {product.images?.[0] ? (
                          <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-10 h-10 text-gray-200" /></div>
                        )}
                        {discount && <span className="absolute top-2 left-2 bg-brand-red text-white text-[10px] font-bold px-2 py-0.5 rounded-lg">{discount}% OFF</span>}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">{product.name}</p>
                        <div className="flex items-baseline gap-1.5 mt-1.5">
                          <span className="text-base font-bold text-gray-900">{formatPrice(product.price)}</span>
                        </div>
                        <p className="text-[10px] text-purple-500 mt-1">{product.reason || 'People near you also bought this'}</p>
                      </div>
                    </button>
                  </ScrollReveal>
                )
              })}
            </div>
          </section>
        </ScrollReveal>
      )}

      {/* All Products */}
      {products.length > 0 && (
        <ScrollReveal direction="up" delay={200}>
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">Just In</h2>
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
    </PageTransition>
  )
}
