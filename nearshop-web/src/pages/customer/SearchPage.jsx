import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PackageSearch, ChevronLeft, ChevronRight, Store, ShoppingBag, Search, X, ArrowUpRight, SlidersHorizontal } from 'lucide-react'
import { useLocationStore } from '../../store/locationStore'
import { searchProducts, getSearchSuggestions } from '../../api/products'
import { searchUnified } from '../../api/search'
import { getCategories } from '../../api/categories'
import EmptyState from '../../components/ui/EmptyState'
import ShopCard from '../../components/ShopCard'
import { PageTransition } from '../../components/ui/PageTransition'
import { SkeletonLoader } from '../../components/ui/SkeletonLoader'
import { getRankingReasonLabel, getRankingReasonTone } from '../../utils/ranking'
import { rankingSearchParams, trackRankingClick, trackRankingImpressions } from '../../utils/rankingTracking'

const DEBOUNCE_MS = 400
const SUGGEST_MS = 180
const PER_PAGE = 20
const TYPE_ICON = { product: '🛍️', shop: '🏪' }
const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

export default function SearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { latitude, longitude } = useLocationStore()

  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '')
  const [activeResultTab, setActiveResultTab] = useState('products')
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)
  const [products, setProducts] = useState([])
  const [shops, setShops] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const debounceTimer = useRef(null)
  const suggestTimer = useRef(null)

  useEffect(() => { inputRef.current?.focus(); getCategories().then(({ data }) => setCategories(data.items ?? data ?? [])).catch(() => {}) }, [])
  useEffect(() => {
    const handler = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setShowSuggestions(false) }
    document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!inputFocused || query.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    clearTimeout(suggestTimer.current)
    suggestTimer.current = setTimeout(async () => {
      try { const res = await getSearchSuggestions(query.trim(), latitude, longitude); const list = res.data?.suggestions ?? []; setSuggestions(list); setShowSuggestions(list.length > 0) } catch { setSuggestions([]) }
    }, SUGGEST_MS)
    return () => clearTimeout(suggestTimer.current)
  }, [query, inputFocused, latitude, longitude])

  const doSearch = useCallback(async (q, category, pg) => {
    if (!q.trim() && !category) { setProducts([]); setShops([]); setTotalCount(0); return }
    setLoading(true)
    try {
      const params = { page: pg, per_page: PER_PAGE }
      if (q.trim()) params.q = q
      if (category) params.category = category

      // Use unified search if query exists
      let productsRes, shopsRes
      if (q.trim()) {
        const unifiedRes = await searchUnified(q, latitude, longitude)
        const unifiedProducts = (unifiedRes.data.products || []).filter(product => !category || product.category === category)
        productsRes = { data: { items: unifiedProducts } }
        shopsRes = { data: { items: unifiedRes.data.shops || [] } }
      } else {
        const [pRes, sRes] = await Promise.allSettled([
          searchProducts(params),
          Promise.resolve({ data: { items: [] } }),
        ])
        productsRes = pRes.status === 'fulfilled' ? pRes.value : { data: { items: [] } }
        shopsRes = sRes.status === 'fulfilled' ? sRes.value : { data: { items: [] } }
      }

      if (productsRes.status === 'fulfilled') { const d = productsRes.value.data; setProducts(d.items ?? []); setTotalCount(d.total ?? 0) } else { setProducts(productsRes?.data?.items ?? []); setTotalCount(0) }
      if (shopsRes.status === 'fulfilled') { setShops(shopsRes.value.data.items ?? []) } else { setShops(shopsRes?.data?.items ?? []) }
    } catch { setProducts([]); setShops([]); setTotalCount(0) } finally { setLoading(false) }
  }, [latitude, longitude])

  useEffect(() => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      const next = {}; if (query) next.q = query; if (selectedCategory) next.category = selectedCategory; if (page > 1) next.page = String(page)
      setSearchParams(next, { replace: true }); doSearch(query, selectedCategory, page)
    }, DEBOUNCE_MS)
    return () => clearTimeout(debounceTimer.current)
  }, [query, selectedCategory, page, doSearch, setSearchParams])

  useEffect(() => {
    if (!query.trim() || !products.length || activeResultTab !== 'products') return
    trackRankingImpressions(products, {
      ranking_surface: 'unified_search',
      source_screen: 'search_results',
      query: query.trim(),
    })
  }, [products, query, activeResultTab])

  const handleSuggestionClick = (item) => { setShowSuggestions(false); if (item.type === 'shop') navigate(`/app/shop/${item.id}`); else { setQuery(item.name); setPage(1) } }
  const totalPages = Math.ceil(totalCount / PER_PAGE)
  const hasResults = products.length > 0 || shops.length > 0

  // Filter sidebar content (reused for desktop sidebar and mobile sheet)
  const FilterContent = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Category</h3>
        <div className="space-y-1">
          <button onClick={() => { setSelectedCategory(''); setPage(1) }}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${!selectedCategory ? 'bg-brand-purple-light text-brand-purple font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
            All Categories
          </button>
          {categories.map(cat => {
            const slug = String(cat.slug ?? cat.id); const active = selectedCategory === slug
            return (
              <button key={slug} onClick={() => { setSelectedCategory(active ? '' : slug); setPage(1) }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${active ? 'bg-brand-purple-light text-brand-purple font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                {cat.name}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Results</h3>
        <div className="space-y-1">
          {[{ id: 'products', label: 'Products', count: products.length }, { id: 'shops', label: 'Shops', count: shops.length }].map(t => (
            <button key={t.id} onClick={() => setActiveResultTab(t.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition flex justify-between ${activeResultTab === t.id ? 'bg-brand-purple-light text-brand-purple font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
              {t.label} <span className="text-xs opacity-60">{t.count}</span>
            </button>
          ))}
        </div>
      </div>
      {(query || selectedCategory) && (
        <button onClick={() => { setQuery(''); setSelectedCategory(''); setPage(1) }}
          className="w-full text-center text-sm text-brand-red hover:underline">Clear all filters</button>
      )}
    </div>
  )

  return (
    <PageTransition>
      <div>
      {/* Search bar */}
      <div ref={containerRef} className="relative mb-6">
        <div className={`flex items-center bg-white border rounded-xl px-4 h-12 transition input-glow ${inputFocused ? 'border-brand-purple shadow-md' : 'border-gray-200'}`}>
          <Search className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
          <input ref={inputRef} autoFocus value={query} onChange={e => { setQuery(e.target.value); setPage(1) }}
            onFocus={() => setInputFocused(true)} onBlur={() => setTimeout(() => setInputFocused(false), 150)}
            placeholder="Search products, shops, categories..." className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none" />
          {query && <button onClick={() => { setQuery(''); setPage(1); setSuggestions([]) }} className="p-1"><X className="w-4 h-4 text-gray-400" /></button>}
          <button onClick={() => setShowMobileFilters(true)} className="lg:hidden ml-2 p-1.5 text-gray-400 hover:text-brand-purple">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
            {suggestions.map((item, idx) => (
              <button key={`${item.type}-${item.id}`} onMouseDown={() => handleSuggestionClick(item)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left ${idx < suggestions.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <span className="text-base">{TYPE_ICON[item.type] ?? '🔍'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                  {item.category && <p className="text-xs text-gray-400">{item.type === 'shop' ? 'Shop' : `in ${item.category}`}</p>}
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-brand-purple flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop: sidebar + results, Mobile: just results */}
      <div className="flex gap-6">
        {/* Desktop filter sidebar */}
        <aside className="hidden lg:block w-60 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-100 p-4 sticky top-24">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Filters</h2>
            <FilterContent />
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {/* Results header */}
          {(query.trim() || selectedCategory) && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                {totalCount > 0 ? `${totalCount} result${totalCount !== 1 ? 's' : ''}` : 'No results'}
                {query.trim() ? ` for "${query.trim()}"` : ''}{selectedCategory ? ` in ${selectedCategory}` : ''}
              </p>
              {/* Mobile: result type tabs */}
              <div className="flex lg:hidden gap-2">
                {['products', 'shops'].map(t => (
                  <button key={t} onClick={() => setActiveResultTab(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${activeResultTab === t ? 'bg-brand-purple text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {t === 'products' ? `Products (${products.length})` : `Shops (${shops.length})`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No query prompt */}
          {!query.trim() && !selectedCategory && (
            <div className="text-center py-16">
              <Search className="w-12 h-12 text-brand-purple/20 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-700">Search NearShop</p>
              <p className="text-sm text-gray-400 mt-1">Find products, shops, and deals near you</p>
              <div className="flex flex-wrap gap-2 justify-center mt-4">
                {['Grocery', 'Electronics', 'Food', 'Beauty', 'Clothing'].map(t => (
                  <button key={t} onClick={() => setQuery(t)} className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-brand-purple hover:text-brand-purple transition">{t}</button>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (query.trim() || selectedCategory) && (
            <SkeletonLoader type="product" count={6} />
          )}

          {/* Products grid */}
          {!loading && (query.trim() || selectedCategory) && activeResultTab === 'products' && (
            <>
              {products.length === 0 ? (
                <EmptyState icon={ShoppingBag} title="No products found" message="Try different keywords" />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4 stagger-list">
                  {products.map((product, idx) => {
                    const discount = product.compare_price && product.price && Number(product.compare_price) > Number(product.price) ? Math.round((1 - product.price / product.compare_price) * 100) : null
                    const reasonLabel = getRankingReasonLabel(product.reason, '')
                    const reasonTone = getRankingReasonTone(product.reason)
                    return (
                      <div key={product.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 0.05}s` }}>
                        <button onClick={() => {
                          trackRankingClick(product, {
                            ranking_surface: 'unified_search',
                            source_screen: 'search_results',
                            query: query.trim(),
                          })
                          navigate(`/app/product/${product.id}${rankingSearchParams({
                            ranking_surface: 'unified_search',
                            source_screen: 'search_results',
                            ranking_reason: product.reason,
                            query: query.trim(),
                          })}`)
                        }}
                          className="w-full bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all text-left group hover-scale">
                          <div className="aspect-square bg-gray-50 relative overflow-hidden">
                            {product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              : <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-10 h-10 text-gray-200" /></div>}
                            {discount && <span className="absolute top-2 left-2 bg-brand-red text-white text-[10px] font-bold px-2 py-0.5 rounded-lg">{discount}% OFF</span>}
                          </div>
                          <div className="p-3">
                            <p className="text-sm font-semibold text-gray-900 line-clamp-2">{product.name}</p>
                            {reasonLabel && (
                              <span className={`inline-flex mt-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${reasonTone}`}>
                                {reasonLabel}
                              </span>
                            )}
                            <div className="flex items-baseline gap-1.5 mt-1.5">
                              <span className="text-base font-bold text-gray-900">{formatPrice(product.price)}</span>
                              {product.compare_price > product.price && <span className="text-xs text-gray-400 line-through">{formatPrice(product.compare_price)}</span>}
                            </div>
                            {product.shop_name && <p className="text-xs text-gray-400 mt-1 truncate">🏪 {product.shop_name}</p>}
                          </div>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-8">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:border-brand-purple transition bg-white"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="text-sm font-medium text-gray-600">Page {page} of {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:border-brand-purple transition bg-white"><ChevronRight className="h-4 w-4" /></button>
                </div>
              )}
            </>
          )}

          {/* Shops list */}
          {!loading && (query.trim() || selectedCategory) && activeResultTab === 'shops' && (
            <>
              {shops.length === 0 ? <EmptyState icon={Store} title="No shops found" message="Try searching in Products" /> : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 stagger-list">
                  {shops.map((shop, idx) => (
                    <div key={shop.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 0.05}s` }}>
                      <button onClick={() => navigate(`/app/shop/${shop.id}`)}
                        className="w-full bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 hover:shadow-md transition text-left hover-lift">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-brand-purple/10 to-brand-purple/5 flex items-center justify-center flex-shrink-0 overflow-hidden border border-gray-100">
                        {shop.logo || shop.cover_image ? <img src={shop.logo ?? shop.cover_image} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">🏪</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{shop.name}</p>
                        {shop.reason && (
                          <span className={`inline-flex mt-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getRankingReasonTone(shop.reason)}`}>
                            {getRankingReasonLabel(shop.reason, 'Recommended shop')}
                          </span>
                        )}
                        <p className="text-xs text-gray-500 mt-0.5">{shop.category}</p>
                        {shop.avg_rating > 0 && <span className="text-xs text-amber-600 font-semibold">⭐ {Number(shop.avg_rating).toFixed(1)}</span>}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    </button>                    </div>                  ))}
                </div>
              )}
            </>
          )}

          {/* No results */}
          {!loading && (query.trim() || selectedCategory) && !hasResults && (
            <div className="text-center py-16">
              <PackageSearch className="w-12 h-12 text-gray-200 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-700">No results for "{query}"</p>
              <p className="text-sm text-gray-400 mt-1">Try different keywords or browse categories</p>
              <button onClick={() => setQuery('')} className="mt-4 px-5 py-2.5 bg-brand-purple text-white rounded-xl text-sm font-bold hover:bg-brand-purple-dark transition">Clear search</button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter sheet */}
      {showMobileFilters && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowMobileFilters(false)} />
          <div className="relative w-full bg-white rounded-t-2xl p-5 pb-8 max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Filters</h3>
              <button onClick={() => setShowMobileFilters(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <FilterContent />
          </div>
        </div>
      )}
    </div>
    </PageTransition>
  )
}
