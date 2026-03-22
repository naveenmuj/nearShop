import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PackageSearch, ChevronLeft, ChevronRight, Store, ShoppingBag, Search, X } from 'lucide-react'
import { useLocationStore } from '../../store/locationStore'
import { searchProducts } from '../../api/products'
import { searchShops } from '../../api/shops'
import { getCategories } from '../../api/categories'
import EmptyState from '../../components/ui/EmptyState'

const DEBOUNCE_MS = 400
const PER_PAGE = 20

const CATEGORY_ICONS = {
  food: '🍔', grocery: '🛒', groceries: '🛒', pharmacy: '💊', electronics: '📱',
  clothing: '👕', fashion: '👗', beauty: '💄', restaurant: '🍽️', bakery: '🥐',
  home: '🏠', jobs: '💼', default: '🏪',
}
const getCategoryIcon = (name = '') => {
  const key = name.toLowerCase().split(' ')[0]
  return CATEGORY_ICONS[key] ?? CATEGORY_ICONS.default
}

export default function SearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { latitude, longitude } = useLocationStore()

  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '')
  const [activeResultTab, setActiveResultTab] = useState('products') // 'products' | 'shops'
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)

  const [products, setProducts] = useState([])
  const [shops, setShops] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState([])
  const inputRef = useRef(null)
  const debounceTimer = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    getCategories()
      .then(({ data }) => setCategories(data.items ?? data ?? []))
      .catch(() => {})
  }, [])

  const doSearch = useCallback(async (q, category, pg) => {
    if (!q.trim() && !category) { setProducts([]); setShops([]); setTotalCount(0); return }
    setLoading(true)
    try {
      const params = { page: pg, per_page: PER_PAGE }
      if (q.trim()) params.q = q
      if (latitude != null) params.lat = latitude
      if (longitude != null) params.lng = longitude
      if (category) params.category = category

      const [productsRes, shopsRes] = await Promise.allSettled([
        searchProducts(params),
        q.trim() ? searchShops(q, latitude != null ? { lat: latitude, lng: longitude } : {}) : Promise.resolve({ data: [] }),
      ])

      if (productsRes.status === 'fulfilled') {
        const d = productsRes.value.data
        setProducts(d.items ?? d.products ?? d ?? [])
        setTotalCount(d.total ?? d.count ?? 0)
      } else {
        setProducts([])
        setTotalCount(0)
      }
      if (shopsRes.status === 'fulfilled') {
        const d = shopsRes.value.data
        setShops(d.items ?? d.shops ?? d ?? [])
      } else {
        setShops([])
      }
    } catch {
      setProducts([]); setShops([]); setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [latitude, longitude])

  useEffect(() => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      const next = {}
      if (query) next.q = query
      if (selectedCategory) next.category = selectedCategory
      if (page > 1) next.page = String(page)
      setSearchParams(next, { replace: true })
      doSearch(query, selectedCategory, page)
    }, DEBOUNCE_MS)
    return () => clearTimeout(debounceTimer.current)
  }, [query, selectedCategory, page, doSearch, setSearchParams])

  const handleQueryChange = (e) => { setQuery(e.target.value); setPage(1) }
  const handleCategorySelect = (slug) => { setSelectedCategory(prev => prev === slug ? '' : slug); setPage(1) }
  const totalPages = Math.ceil(totalCount / PER_PAGE)
  const hasResults = products.length > 0 || shops.length > 0

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Search bar */}
      <div className="bg-white px-4 pt-4 pb-3 border-b border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0 hover:bg-gray-200 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className={`flex items-center gap-2 flex-1 bg-gray-100 rounded-2xl px-3.5 h-11 border-2 transition-all ${query ? 'border-[#5B2BE7]/30 bg-white' : 'border-transparent'}`}>
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={handleQueryChange}
              placeholder="Search products, shops..."
              className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setPage(1) }}
                className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center hover:bg-gray-400 transition-colors flex-shrink-0"
              >
                <X className="w-3 h-3 text-gray-600" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category filter strip */}
      {categories.length > 0 && (
        <div className="bg-white border-b border-gray-100 px-4 py-2.5">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => handleCategorySelect('')}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all ${
                !selectedCategory ? 'bg-[#5B2BE7] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {categories.map(cat => {
              const slug = String(cat.slug ?? cat.id)
              const active = selectedCategory === slug
              return (
                <button
                  key={slug}
                  onClick={() => handleCategorySelect(slug)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-2xl text-xs font-bold transition-all ${
                    active ? 'bg-[#5B2BE7] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>{getCategoryIcon(cat.name)}</span>
                  {cat.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="px-4 pt-4 pb-6">
        {/* No query — prompt */}
        {!query.trim() && !selectedCategory && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-20 h-20 bg-[#5B2BE7]/8 rounded-3xl flex items-center justify-center">
              <Search className="w-9 h-9 text-[#5B2BE7]/40" />
            </div>
            <p className="text-base font-bold text-gray-700">Search NearShop</p>
            <p className="text-sm text-gray-400 text-center">
              Find products, shops, and deals<br />near your location
            </p>
          </div>
        )}

        {/* Loading state */}
        {loading && (query.trim() || selectedCategory) && (
          <div className="space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white rounded-2xl h-20 animate-pulse border border-gray-100" />
            ))}
          </div>
        )}

        {/* Has results */}
        {!loading && (query.trim() || selectedCategory) && hasResults && (
          <>
            {/* Result type tabs */}
            <div className="flex gap-2 mb-4">
              {[
                { id: 'products', label: 'Products', count: products.length, icon: ShoppingBag },
                { id: 'shops', label: 'Shops', count: shops.length, icon: Store },
              ].map(({ id, label, count, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveResultTab(id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all border ${
                    activeResultTab === id
                      ? 'bg-[#5B2BE7] text-white border-[#5B2BE7] shadow-sm shadow-purple-200'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-[#5B2BE7]/30'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    activeResultTab === id ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {count}
                  </span>
                </button>
              ))}
              <p className="ml-auto text-xs text-gray-400 self-center">
                {totalCount > 0 ? `${totalCount} result${totalCount !== 1 ? 's' : ''}` : ''}
              </p>
            </div>

            {/* Products grid */}
            {activeResultTab === 'products' && (
              <>
                {products.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                      <ShoppingBag className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="font-semibold text-gray-600">No products found</p>
                    <p className="text-sm text-gray-400 mt-1">Try "{query}" in Shops tab</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {products.map(product => {
                      const discount = product.compare_price > product.price
                        ? Math.round((1 - product.price / product.compare_price) * 100) : null
                      return (
                        <button
                          key={product.id}
                          onClick={() => navigate(`/app/product/${product.id}`)}
                          className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.97] text-left"
                        >
                          <div className="relative aspect-square bg-gray-50">
                            {product.images?.[0] ? (
                              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ShoppingBag className="w-10 h-10 text-gray-200" />
                              </div>
                            )}
                            {discount && (
                              <span className="absolute top-2 left-2 bg-[#E24B4A] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {discount}% off
                              </span>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-tight">{product.name}</p>
                            <div className="flex items-baseline gap-1.5 mt-1.5">
                              <span className="text-base font-bold text-gray-900">₹{product.price}</span>
                              {product.compare_price > product.price && (
                                <span className="text-xs text-gray-400 line-through">₹{product.compare_price}</span>
                              )}
                            </div>
                            {product.shop_name && (
                              <p className="text-xs text-gray-400 mt-1 truncate">🏪 {product.shop_name}</p>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="p-2.5 rounded-xl border-2 border-gray-200 disabled:opacity-40 hover:border-[#5B2BE7] transition-colors bg-white">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-semibold text-gray-600">Page {page} of {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="p-2.5 rounded-xl border-2 border-gray-200 disabled:opacity-40 hover:border-[#5B2BE7] transition-colors bg-white">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Shops list */}
            {activeResultTab === 'shops' && (
              <>
                {shops.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
                      <Store className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="font-semibold text-gray-600">No shops found</p>
                    <p className="text-sm text-gray-400 mt-1">Try searching in Products tab</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {shops.map(shop => (
                      <button
                        key={shop.id}
                        onClick={() => navigate(`/app/shop/${shop.id}`)}
                        className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98] text-left"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#5B2BE7]/10 to-[#7F77DD]/10 flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100">
                          {shop.logo || shop.cover_image ? (
                            <img src={shop.logo ?? shop.cover_image} alt={shop.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-2xl">{getCategoryIcon(shop.category)}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-gray-900 truncate">{shop.name}</p>
                            {shop.is_verified && (
                              <span className="text-[10px] font-bold bg-[#1D9E75]/10 text-[#1D9E75] px-1.5 py-0.5 rounded-full flex-shrink-0">✓</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{shop.category}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {shop.avg_rating > 0 && (
                              <span className="text-xs text-amber-600 font-semibold">⭐ {Number(shop.avg_rating).toFixed(1)}</span>
                            )}
                            {shop.is_open != null && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${shop.is_open ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {shop.is_open ? 'Open' : 'Closed'}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* No results */}
        {!loading && (query.trim() || selectedCategory) && !hasResults && (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mb-4">
              <PackageSearch className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-base font-bold text-gray-700">No results for "{query}"</p>
            <p className="text-sm text-gray-400 mt-1">Try different keywords or browse categories</p>
            <button
              onClick={() => setQuery('')}
              className="mt-4 px-5 py-2.5 bg-[#5B2BE7] text-white rounded-2xl text-sm font-bold hover:bg-[#4a23d0] transition-colors"
            >
              Clear search
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
