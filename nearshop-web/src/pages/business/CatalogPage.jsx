import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, Grid3X3, List, Eye, Heart, MessageSquare, ToggleLeft, Trash2, Upload, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getShopProducts } from '../../api/shops'
import { toggleAvailability, deleteProduct } from '../../api/products'
import useMyShop from '../../hooks/useMyShop'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const formatPrice = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'name', label: 'Name' },
  { key: 'price_asc', label: 'Price ↑' },
  { key: 'price_desc', label: 'Price ↓' },
  { key: 'views', label: 'Most Viewed' },
]

const SCROLL_KEY = 'bizCatalogScrollY'

export default function CatalogPage() {
  const navigate = useNavigate()
  const { shopId, loading: shopLoading } = useMyShop()
  const [searchParams, setSearchParams] = useSearchParams()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [acting, setActing] = useState(null)

  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [viewMode, setViewMode] = useState(searchParams.get('view') || 'list')
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest')
  const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'all')

  useEffect(() => {
    const next = new URLSearchParams(searchParams)

    if (search) next.set('q', search)
    else next.delete('q')

    if (viewMode !== 'list') next.set('view', viewMode)
    else next.delete('view')

    if (sortBy !== 'newest') next.set('sort', sortBy)
    else next.delete('sort')

    if (filterStatus !== 'all') next.set('status', filterStatus)
    else next.delete('status')

    setSearchParams(next, { replace: true })
  }, [filterStatus, search, searchParams, setSearchParams, sortBy, viewMode])

  const load = useCallback(async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const res = await getShopProducts(shopId, { per_page: 200, include_hidden: true })
      const d = res.data
      setProducts(Array.isArray(d) ? d : d?.items ?? [])
    } catch {
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const savedY = Number(sessionStorage.getItem(SCROLL_KEY) || 0)
    if (savedY > 0) {
      requestAnimationFrame(() => window.scrollTo({ top: savedY, behavior: 'auto' }))
    }
  }, [])

  const saveScrollPosition = () => {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY || 0))
  }

  const filtered = useMemo(() => {
    let list = [...products]

    if (search) {
      const query = search.toLowerCase()
      list = list.filter((p) => p.name?.toLowerCase().includes(query) || p.category?.toLowerCase().includes(query))
    }

    if (filterStatus === 'active') list = list.filter((p) => p.is_available)
    else if (filterStatus === 'hidden') list = list.filter((p) => !p.is_available)

    if (sortBy === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    else if (sortBy === 'price_asc') list.sort((a, b) => Number(a.price) - Number(b.price))
    else if (sortBy === 'price_desc') list.sort((a, b) => Number(b.price) - Number(a.price))
    else if (sortBy === 'views') list.sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    else list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))

    return list
  }, [products, search, filterStatus, sortBy])

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map((p) => p.id)))
  }

  const handleToggle = async (event, product) => {
    event.stopPropagation()
    setActing(product.id)
    try {
      await toggleAvailability(product.id)
      toast.success(product.is_available ? 'Product hidden' : 'Product made live')
      await load()
    } catch {
      toast.error('Failed to update product')
    } finally {
      setActing(null)
    }
  }

  const handleDelete = async (event, product) => {
    event.stopPropagation()
    const confirmed = window.confirm(`Delete "${product.name}"?`)
    if (!confirmed) return

    setActing(product.id)
    try {
      await deleteProduct(product.id)
      toast.success('Product deleted')
      await load()
    } catch {
      toast.error('Failed to delete product')
    } finally {
      setActing(null)
    }
  }

  const openProductDetails = (productId) => {
    saveScrollPosition()
    navigate(`/biz/catalog/${productId}`)
  }

  const activeCount = products.filter((p) => p.is_available).length
  const hiddenCount = products.length - activeCount

  if (shopLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">My Products</h1>
            <p className="text-xs text-gray-500">{products.length} total · {activeCount} active · {hiddenCount} hidden</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/biz/catalog/bulk')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              <Upload className="h-3.5 w-3.5" /> Bulk
            </button>
            <button
              onClick={() => navigate('/biz/snap')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1D9E75] px-3 py-2 text-xs font-bold text-white hover:bg-[#178a65]"
            >
              <Plus className="h-3.5 w-3.5" /> Add Product
            </button>
          </div>
        </div>

        <button
          onClick={() => navigate('/biz/snap')}
          className="mb-4 flex w-full items-center gap-3 rounded-xl border border-[#7F77DD]/20 bg-[#EEEDFE] p-3 text-left hover:bg-[#e5e3ff]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#534AB7]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#534AB7]">Analyze product image</p>
            <p className="text-xs text-[#6b66b7]">Auto-fill product details with AI like mobile snap listing.</p>
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 min-w-[240px] flex-1 items-center rounded-xl bg-gray-100 px-3">
            <Search className="mr-2 h-4 w-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-10 rounded-xl bg-gray-100 px-3 text-xs font-semibold text-gray-700 outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>

          <div className="flex overflow-hidden rounded-xl bg-gray-100">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
            >
              <List className="h-4 w-4 text-gray-700" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
            >
              <Grid3X3 className="h-4 w-4 text-gray-700" />
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {['all', 'active', 'hidden'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`rounded-lg px-3 py-1 text-xs font-bold ${
                filterStatus === status ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {status[0].toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="flex items-center justify-between rounded-xl bg-[#1D9E75] px-4 py-2.5 text-white">
          <div className="text-xs font-bold">{selected.size} selected</div>
          <button onClick={selectAll} className="text-xs font-semibold text-white/90 hover:text-white">
            {selected.size === filtered.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      ) : null}

      <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
            <div className="mb-3 text-5xl">📦</div>
            <h3 className="text-lg font-bold text-gray-900">No products found</h3>
            <p className="mt-1 text-sm text-gray-500">Try changing filters or add a new product.</p>
            <button
              onClick={() => navigate('/biz/snap')}
              className="mt-4 rounded-xl bg-[#1D9E75] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#178a65]"
            >
              Add Product
            </button>
          </div>
        ) : filtered.map((product) => {
          const isSelected = selected.has(product.id)
          const imageUrl = product.images?.[0] || product.image_url
          const isLive = product.is_available ?? true

          return (
            <button
              key={product.id}
              onClick={() => openProductDetails(product.id)}
              className={`w-full rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                isSelected ? 'border-[#1D9E75] ring-1 ring-[#1D9E75]' : 'border-gray-100'
              } ${viewMode === 'grid' ? '' : 'flex items-center gap-3'}`}
            >
              <div className={`${viewMode === 'grid' ? 'mb-3 aspect-square w-full' : 'h-14 w-14'} overflow-hidden rounded-xl bg-gray-100`}>
                {imageUrl ? (
                  <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300">📦</div>
                )}
              </div>

              <div className={viewMode === 'grid' ? '' : 'min-w-0 flex-1'}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold text-gray-900">{product.name}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSelect(product.id)
                    }}
                    className={`h-5 w-5 rounded border text-[10px] font-bold ${
                      isSelected ? 'border-[#1D9E75] bg-[#1D9E75] text-white' : 'border-gray-300 text-transparent'
                    }`}
                  >
                    ✓
                  </button>
                </div>

                <div className="mb-1.5 flex items-center gap-2">
                  <span className="text-sm font-extrabold text-gray-900">{formatPrice(product.price)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isLive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {isLive ? 'Live' : 'Hidden'}
                  </span>
                </div>

                <div className="mb-2 flex items-center gap-3 text-[11px] text-gray-500">
                  <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{product.view_count || 0}</span>
                  <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" />{product.wishlist_count || 0}</span>
                  <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{product.inquiry_count || 0}</span>
                </div>

                <div className="flex gap-1.5">
                  <button
                    onClick={(e) => handleToggle(e, product)}
                    disabled={acting === product.id}
                    className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                      isLive ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-600 text-white hover:bg-green-700'
                    } disabled:opacity-60`}
                  >
                    <span className="inline-flex items-center gap-1"><ToggleLeft className="h-3 w-3" />{isLive ? 'Hide' : 'Make Live'}</span>
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, product)}
                    disabled={acting === product.id}
                    className="rounded-lg bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-100 disabled:opacity-60"
                  >
                    <span className="inline-flex items-center gap-1"><Trash2 className="h-3 w-3" />Delete</span>
                  </button>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
