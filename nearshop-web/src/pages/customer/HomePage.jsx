import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Store, Bell, Search, ChevronRight, Zap, ChevronDown } from 'lucide-react'
import { useLocation } from '../../hooks/useLocation'
import { useAuthStore } from '../../store/authStore'
import { getNearbyShops } from '../../api/shops'
import { getNearbyDeals } from '../../api/deals'
import { getStoriesFeed } from '../../api/stories'
import { getCategories } from '../../api/categories'
import StoryCircle from '../../components/StoryCircle'
import EmptyState from '../../components/ui/EmptyState'
import { ProductCardSkeleton } from '../../components/Skeleton'
import LocationPicker from '../../components/LocationPicker'

const CATEGORY_ICONS = {
  food: '🍔', grocery: '🛒', pharmacy: '💊', electronics: '📱',
  clothing: '👕', beauty: '💄', restaurant: '🍽️', bakery: '🥐',
  default: '🏪',
}

export default function HomePage() {
  const navigate = useNavigate()
  const { latitude, longitude, locationName, isLoading: locationLoading } = useLocation()
  const { isAuthenticated, user } = useAuthStore()

  const [shops, setShops] = useState([])
  const [deals, setDeals] = useState([])
  const [stories, setStories] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showLocationPicker, setShowLocationPicker] = useState(false)

  useEffect(() => {
    if (!latitude || !longitude) return
    const fetchAll = async () => {
      setLoading(true)
      setError(null)
      try {
        const requests = [
          getNearbyShops(latitude, longitude, { limit: 10 }),
          getNearbyDeals(latitude, longitude, { limit: 6 }),
          getCategories(),
        ]
        if (isAuthenticated) requests.push(getStoriesFeed())
        const [shopsRes, dealsRes, categoriesRes, storiesRes] = await Promise.all(requests)
        setShops(shopsRes.data.items ?? shopsRes.data ?? [])
        setDeals(dealsRes.data.items ?? dealsRes.data ?? [])
        setCategories(categoriesRes.data.items ?? categoriesRes.data ?? [])
        if (storiesRes) setStories(storiesRes.data.items ?? storiesRes.data ?? [])
      } catch (err) {
        setError(err.message || 'Failed to load content')
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [latitude, longitude, isAuthenticated])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const firstName = user?.name?.split(' ')[0] || 'there'

  return (
    <>
    <div className="bg-gray-50 min-h-screen">
      {/* Gradient header */}
      <div className="bg-gradient-to-br from-[#5B2BE7] via-[#7F77DD] to-[#38BDF8] px-4 pt-5 pb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/70 text-xs font-medium">{greeting()},</p>
            <h1 className="text-white text-xl font-extrabold tracking-tight">{firstName} 👋</h1>
          </div>
          <button
            onClick={() => navigate('/app/notifications')}
            className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20"
          >
            <Bell className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Location pill — clickable to open picker */}
        <button
          onClick={() => setShowLocationPicker(true)}
          className="inline-flex items-center gap-1.5 mb-4 bg-white/15 backdrop-blur-sm hover:bg-white/25 active:bg-white/30 rounded-full px-3 py-1.5 transition-all"
        >
          <MapPin className="w-3.5 h-3.5 text-white flex-shrink-0" />
          <span className="text-white/90 text-xs font-medium truncate max-w-[200px]">
            {locationLoading ? 'Getting location...' : locationName || 'Set your location'}
          </span>
          <ChevronDown className="w-3 h-3 text-white/70 flex-shrink-0" />
        </button>

        {/* Search bar */}
        <button
          onClick={() => navigate('/app/search')}
          className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 h-12 text-left shadow-lg shadow-black/10"
        >
          <Search className="w-4 h-4 text-gray-400" />
          <span className="flex-1 text-sm text-gray-400">Search products, shops...</span>
        </button>
      </div>

      {/* Content area with top-rounding to overlay header */}
      <div className="bg-gray-50 rounded-t-3xl -mt-4 pt-5 px-4 pb-6 space-y-6">

        {/* Stories */}
        {isAuthenticated && stories.length > 0 && (
          <section>
            <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
              {stories.map(story => (
                <div key={story.id ?? story.shop_id} className="flex-shrink-0 flex flex-col items-center gap-1.5">
                  <div className="w-16 h-16 rounded-full ring-2 ring-[#5B2BE7] ring-offset-2 overflow-hidden shadow-md">
                    <StoryCircle story={story} onClick={() => {}} />
                  </div>
                  <span className="text-[10px] text-gray-500 font-medium truncate w-16 text-center">
                    {story.shop_name ?? story.name ?? ''}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Deals */}
        {deals.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#E24B4A] fill-[#E24B4A]" />
                <span className="text-base font-bold text-gray-900">Live Deals</span>
                <span className="inline-block w-2 h-2 bg-[#E24B4A] rounded-full animate-pulse" />
              </div>
              <button
                onClick={() => navigate('/app/deals')}
                className="flex items-center gap-0.5 text-xs font-semibold text-[#5B2BE7]"
              >
                See all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {deals.map(deal => (
                <button
                  key={deal.id}
                  onClick={() => navigate('/app/deals')}
                  className="flex-shrink-0 w-44 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all active:scale-[0.97] text-left"
                >
                  <div className="bg-gradient-to-br from-[#E24B4A] to-[#D85A30] p-3">
                    <span className="text-white text-lg font-extrabold">
                      {deal.discount_percent ? `${deal.discount_percent}% OFF` : '🔥 Deal'}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight">{deal.title ?? deal.name}</p>
                    <p className="text-xs text-gray-400 mt-1 truncate">{deal.shop_name ?? ''}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <section>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setSelectedCategory('')}
                className={`flex-shrink-0 px-4 py-2 rounded-2xl text-sm font-semibold transition-all ${
                  selectedCategory === ''
                    ? 'bg-[#5B2BE7] text-white shadow-sm'
                    : 'bg-white text-gray-600 border border-gray-200'
                }`}
              >
                All
              </button>
              {categories.map(cat => {
                const slug = cat.slug ?? cat.id
                const active = selectedCategory === String(slug)
                const icon = CATEGORY_ICONS[String(cat.name).toLowerCase()] ?? CATEGORY_ICONS.default
                return (
                  <button
                    key={slug}
                    onClick={() => {
                      setSelectedCategory(active ? '' : String(slug))
                      navigate(`/app/search?category=${slug}`)
                    }}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-2xl text-sm font-semibold transition-all ${
                      active
                        ? 'bg-[#5B2BE7] text-white shadow-sm'
                        : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                  >
                    <span>{icon}</span>
                    {cat.name}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Nearby Shops */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-900">Nearby Shops</h2>
            <button
              onClick={() => navigate('/app/shops/map')}
              className="flex items-center gap-0.5 text-xs font-semibold text-[#5B2BE7]"
            >
              Map view <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading && (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          )}

          {!loading && error && (
            <EmptyState icon={Store} title="Could not load shops" message={error} />
          )}

          {!loading && !error && !latitude && (
            <EmptyState icon={MapPin} title="Location needed" message="Allow location access to discover shops near you." />
          )}

          {!loading && !error && latitude && shops.length === 0 && (
            <EmptyState icon={Store} title="No shops nearby" message="There are no shops in your area yet." />
          )}

          {!loading && shops.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {shops.map(shop => (
                <button
                  key={shop.id}
                  onClick={() => navigate(`/app/shop/${shop.id}`)}
                  className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.97] text-left"
                >
                  <div className="relative aspect-[4/3]">
                    {shop.image || shop.cover_image ? (
                      <img src={shop.image ?? shop.cover_image} alt={shop.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#5B2BE7]/10 to-[#7F77DD]/10 flex items-center justify-center">
                        <Store className="w-8 h-8 text-[#7F77DD]" />
                      </div>
                    )}
                    {(shop.discount ?? 0) > 0 && (
                      <div className="absolute top-2 left-2 bg-[#E24B4A] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        {shop.discount}% off
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight">{shop.name}</p>
                    {shop.price && (
                      <div className="flex items-baseline gap-1.5 mt-1.5">
                        <span className="text-base font-bold text-gray-900">₹{shop.price}</span>
                        {shop.mrp > shop.price && (
                          <span className="text-xs text-gray-400 line-through">₹{shop.mrp}</span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1 truncate">
                      {shop.category ?? shop.shop_name ?? ''}
                      {shop.distance ? ` · ${shop.distance}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>

      {/* Location Picker modal */}
      {showLocationPicker && (
        <LocationPicker onClose={() => setShowLocationPicker(false)} />
      )}
    </>
  )
}
