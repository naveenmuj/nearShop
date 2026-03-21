import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PackageSearch, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLocationStore } from '../../store/locationStore'
import { searchProducts } from '../../api/products'
import { getCategories } from '../../api/categories'
import ProductGrid from '../../components/ProductGrid'
import EmptyState from '../../components/ui/EmptyState'

const DEBOUNCE_MS = 400
const PER_PAGE = 20

export default function SearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { latitude, longitude } = useLocationStore()

  // Initialise from URL params so the page is bookmarkable / shareable
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '')
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1)

  const [products, setProducts] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const [categories, setCategories] = useState([])

  // Ref to hold the debounce timer
  const debounceTimer = useRef(null)

  // Fetch categories once on mount
  useEffect(() => {
    getCategories()
      .then(({ data }) => setCategories(data.items ?? data ?? []))
      .catch(() => {})
  }, [])

  // Core search function
  const doSearch = useCallback(
    async (q, category, pg) => {
      if (!q.trim()) {
        setProducts([])
        setTotalCount(0)
        return
      }

      setLoading(true)
      try {
        const params = { q, page: pg, per_page: PER_PAGE }
        if (latitude != null) params.lat = latitude
        if (longitude != null) params.lng = longitude
        if (category) params.category = category

        const { data } = await searchProducts(params)
        setProducts(data.items ?? data.products ?? data ?? [])
        setTotalCount(data.total ?? data.count ?? 0)
      } catch {
        setProducts([])
        setTotalCount(0)
      } finally {
        setLoading(false)
      }
    },
    [latitude, longitude]
  )

  // Debounce query changes; category/page changes fire immediately
  useEffect(() => {
    clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      // Update URL params
      const next = {}
      if (query) next.q = query
      if (selectedCategory) next.category = selectedCategory
      if (page > 1) next.page = String(page)
      setSearchParams(next, { replace: true })

      doSearch(query, selectedCategory, page)
    }, DEBOUNCE_MS)

    return () => clearTimeout(debounceTimer.current)
  }, [query, selectedCategory, page, doSearch, setSearchParams])

  const handleQueryChange = (e) => {
    setQuery(e.target.value)
    setPage(1) // reset to first page on new query
  }

  const handleCategorySelect = (slug) => {
    setSelectedCategory((prev) => (prev === slug ? '' : slug))
    setPage(1)
  }

  const totalPages = Math.ceil(totalCount / PER_PAGE)

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Top bar: back + search input */}
      <div className="bg-white px-4 pt-5 pb-4 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0"
        >
          <span className="text-gray-600 text-sm font-bold">←</span>
        </button>
        <div className="flex items-center gap-3 flex-1 bg-white rounded-2xl shadow-card px-4 h-12 border border-gray-100">
          <span className="text-gray-400 text-lg">🔍</span>
          <input
            autoFocus
            value={query}
            onChange={handleQueryChange}
            placeholder="Search products, shops..."
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              ✕
            </button>
          )}
          <button className="flex-shrink-0 text-gray-400 hover:text-gray-600">
            📷
          </button>
        </div>
      </div>

      <div className="px-4 pt-3 pb-6 space-y-4">
        {/* Category filter strip + Sort */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
              {categories.map((cat) => {
                const slug = cat.slug ?? cat.id
                const active = selectedCategory === String(slug)
                return (
                  <button
                    key={slug}
                    onClick={() => handleCategorySelect(String(slug))}
                    className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      active
                        ? 'bg-brand-purple text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {cat.name}
                  </button>
                )
              })}
            </div>
            <button className="flex-shrink-0 flex items-center gap-1 bg-white rounded-xl shadow-card px-3 h-8 text-xs font-medium text-gray-600 border border-gray-100">
              Relevance ▾
            </button>
          </div>
        )}

        {/* Result count */}
        {!loading && query.trim() && totalCount > 0 && (
          <p className="text-sm text-gray-500">
            {totalCount} result{totalCount !== 1 ? 's' : ''} for &quot;{query}&quot;
          </p>
        )}

        {/* Results */}
        {query.trim() ? (
          <>
            <ProductGrid
              products={products}
              loading={loading}
              emptyMessage={`No products found for '${query}'`}
              onProductClick={(product) => navigate(`/app/product/${product.id}`)}
            />

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-xl border border-gray-200 disabled:opacity-40 hover:border-brand-purple transition-colors bg-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-xl border border-gray-200 disabled:opacity-40 hover:border-brand-purple transition-colors bg-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </>
        ) : (
          /* Empty / no-query state */
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-5xl">🔍</span>
            <p className="text-base font-semibold text-gray-700">
              {query ? `No results for '${query}'` : 'Search for products'}
            </p>
            <p className="text-sm text-gray-400">
              {query ? 'Try different keywords' : 'Type a product name to find items near you'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
