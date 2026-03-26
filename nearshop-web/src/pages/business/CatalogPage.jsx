import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, Search, Grid3X3, List, Eye, Heart, MessageSquare, ToggleLeft, Trash2, Tag, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { getShopProducts } from '../../api/shops'
import { toggleAvailability, deleteProduct } from '../../api/products'
import useMyShop from '../../hooks/useMyShop'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'name', label: 'Name' },
  { key: 'price_asc', label: 'Price ↑' },
  { key: 'price_desc', label: 'Price ↓' },
  { key: 'views', label: 'Most Viewed' },
]

export default function CatalogPage() {
  const navigate = useNavigate()
  const { shopId, loading: shopLoading } = useMyShop()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('list') // 'list' | 'grid'
  const [sortBy, setSortBy] = useState('newest')
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'active' | 'hidden'
  const [selected, setSelected] = useState(new Set())
  const [acting, setActing] = useState(null)

  const load = useCallback(async () => {
    if (!shopId) return
    setLoading(true)
    try {
      const res = await getShopProducts(shopId, { per_page: 100 })
      const d = res.data
      setProducts(Array.isArray(d) ? d : d?.items ?? [])
    } catch {
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    let list = [...products]

    // Search filter
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q))
    }

    // Status filter
    if (filterStatus === 'active') list = list.filter(p => p.is_available)
    else if (filterStatus === 'hidden') list = list.filter(p => !p.is_available)

    // Sort
    if (sortBy === 'name') list.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    else if (sortBy === 'price_asc') list.sort((a, b) => Number(a.price) - Number(b.price))
    else if (sortBy === 'price_desc') list.sort((a, b) => Number(b.price) - Number(a.price))
    else if (sortBy === 'views') list.sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    else list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    return list
  }, [products, search, filterStatus, sortBy])

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(p => p.id)))
  }

  const handleToggle = async (product) => {
    setActing(product.id)
    try {
      await toggleAvailability(product.id)
      toast.success(product.is_available ? 'Product hidden' : 'Product visible')
      await load()
    } catch {
      toast.error('Failed to update')
    } finally {
      setActing(null)
    }
  }

  const handleDelete = async (product) => {
    if (!confirm(`Delete "${product.name}"?`)) return
    setActing(product.id)
    try {
      await deleteProduct(product.id)
      toast.success('Product deleted')
      await load()
    } catch {
      toast.error('Failed to delete')
    } finally {
      setActing(null)
    }
  }

  if (shopLoading || loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">My Products</h1>
            <p className="text-xs text-gray-400">{products.length} total · {products.filter(p => p.is_available).length} active</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/biz/catalog/bulk')} className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors">
              <Upload className="w-3.5 h-3.5" /> Bulk
            </button>
            <button onClick={() => navigate('/biz/snap')} className="flex items-center gap-1.5 bg-[#1D9E75] text-white px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-[#178a65] transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-gray-100 rounded-lg px-3 h-9">
            <Search className="w-3.5 h-3.5 text-gray-400 mr-2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
              className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder-gray-400" />
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            className="h-9 bg-gray-100 rounded-lg px-2 text-xs font-medium text-gray-600 border-none outline-none">
            {SORT_OPTIONS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <div className="flex bg-gray-100 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}>
              <List className="w-3.5 h-3.5 text-gray-600" />
            </button>
            <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}>
              <Grid3X3 className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Status filter pills */}
        <div className="flex gap-2 mt-2.5">
          {['all', 'active', 'hidden'].map(f => (
            <button key={f} onClick={() => setFilterStatus(f)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                filterStatus === f ? 'bg-[#1D9E75] text-white' : 'bg-gray-100 text-gray-500'
              }`}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && ` (${f === 'active' ? products.filter(p => p.is_available).length : products.filter(p => !p.is_available).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="bg-[#1D9E75] px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={selectAll} className="text-xs text-white/80 hover:text-white font-medium">
              {selected.size === filtered.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-xs text-white font-bold">{selected.size} selected</span>
          </div>
          <div className="flex gap-2">
            <button className="text-xs text-white/80 hover:text-white font-medium flex items-center gap-1">
              <ToggleLeft className="w-3.5 h-3.5" /> Toggle
            </button>
            <button className="text-xs text-white/80 hover:text-white font-medium flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
        </div>
      )}

      {/* Product list/grid */}
      <div className={`px-4 py-3 ${viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}`}>
        {filtered.length === 0 ? (
          <div className="text-center py-16 col-span-2">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-gray-600 font-semibold">No products found</p>
            <button onClick={() => navigate('/biz/snap')} className="mt-3 bg-[#1D9E75] text-white px-5 py-2.5 rounded-xl text-sm font-bold">
              Add your first product
            </button>
          </div>
        ) : filtered.map(product => {
          const isSelected = selected.has(product.id)
          const imageUrl = product.images?.[0]
          const isLive = product.is_available

          if (viewMode === 'grid') {
            return (
              <div key={product.id} className={`bg-white rounded-xl border overflow-hidden shadow-sm ${isSelected ? 'border-[#1D9E75] ring-1 ring-[#1D9E75]' : 'border-gray-100'}`}>
                <div className="relative aspect-square bg-gray-50">
                  {imageUrl ? <img src={imageUrl} alt="" className="w-full h-full object-cover" /> : (
                    <div className="w-full h-full flex items-center justify-center text-3xl text-gray-200">📦</div>
                  )}
                  <button onClick={() => toggleSelect(product.id)}
                    className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'bg-[#1D9E75] border-[#1D9E75]' : 'bg-white/80 border-gray-300'
                    }`}>
                    {isSelected && <span className="text-white text-xs">✓</span>}
                  </button>
                  {!isLive && <span className="absolute top-2 right-2 bg-gray-900/60 text-white text-[10px] font-bold px-2 py-0.5 rounded">Hidden</span>}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-sm font-bold text-gray-900">{formatPrice(product.price)}</span>
                    {product.compare_price > product.price && (
                      <span className="text-xs text-gray-400 line-through">{formatPrice(product.compare_price)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                    <span>{product.view_count || 0} 👁️</span>
                    <span>{product.wishlist_count || 0} ❤️</span>
                  </div>
                </div>
              </div>
            )
          }

          // List view
          return (
            <div key={product.id} className={`bg-white rounded-xl p-3 border shadow-sm flex items-center gap-3 ${isSelected ? 'border-[#1D9E75] ring-1 ring-[#1D9E75]' : 'border-gray-100'}`}>
              <button onClick={() => toggleSelect(product.id)}
                className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                  isSelected ? 'bg-[#1D9E75] border-[#1D9E75]' : 'border-gray-300'
                }`}>
                {isSelected && <span className="text-white text-[10px]">✓</span>}
              </button>
              <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                {imageUrl ? <img src={imageUrl} alt="" className="w-full h-full object-cover" /> : (
                  <div className="w-full h-full flex items-center justify-center text-lg text-gray-300">📦</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-bold text-gray-800">{formatPrice(product.price)}</span>
                  {product.compare_price > product.price && (
                    <span className="text-xs text-gray-400 line-through">{formatPrice(product.compare_price)}</span>
                  )}
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isLive ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                    {isLive ? 'Active' : 'Hidden'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                  <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{product.view_count || 0}</span>
                  <span className="flex items-center gap-0.5"><Heart className="w-3 h-3" />{product.wishlist_count || 0}</span>
                  <span className="flex items-center gap-0.5"><MessageSquare className="w-3 h-3" />{product.inquiry_count || 0}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button onClick={() => handleToggle(product)} disabled={acting === product.id}
                  className={`text-[10px] font-semibold px-2 py-1 rounded transition-colors ${
                    isLive ? 'text-gray-500 bg-gray-50 hover:bg-gray-100' : 'text-white bg-green-600 hover:bg-green-700'
                  }`}>
                  {isLive ? 'Hide' : 'Make Live'}
                </button>
                <button onClick={() => handleDelete(product)} disabled={acting === product.id}
                  className="text-[10px] font-semibold text-red-500 bg-red-50 px-2 py-1 rounded hover:bg-red-100 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
