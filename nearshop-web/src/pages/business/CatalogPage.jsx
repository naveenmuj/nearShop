import { useState, useEffect } from 'react'
import { Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { getShopProducts, getMyShops } from '../../api/shops'
import { toggleAvailability, deleteProduct } from '../../api/products'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

export default function CatalogPage() {
  const [shopId, setShopId] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [acting, setActing] = useState(null)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  const fetchProducts = async (sid) => {
    if (!sid) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await getShopProducts(sid, { page: 1, per_page: 50 })
      setProducts(data.items || data || [])
    } catch (err) {
      setError(err.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getMyShops()
      .then(({ data }) => {
        if (data?.length > 0) {
          setShopId(data[0].id)
          fetchProducts(data[0].id)
        } else {
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))
  }, [])

  const handleToggle = async (productId) => {
    setActing(productId)
    try {
      await toggleAvailability(productId)
      setProducts((prev) =>
        prev.map((p) => p.id === productId ? { ...p, is_available: !p.is_available } : p)
      )
    } catch {
      toast.error('Failed to update availability')
    } finally {
      setActing(null)
    }
  }

  const handleDelete = async (productId) => {
    if (!window.confirm('Delete this product?')) return
    setActing(productId)
    try {
      await deleteProduct(productId)
      setProducts((prev) => prev.filter((p) => p.id !== productId))
      toast.success('Product deleted')
    } catch {
      toast.error('Failed to delete product')
    } finally {
      setActing(null)
    }
  }

  const filtered = products.filter((p) =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen px-4 py-4">
        <h1 className="text-2xl font-bold mb-4">Catalog</h1>
        <EmptyState icon={Package} title="Could not load products" message={error} action="Retry" onAction={() => fetchProducts(shopId)} />
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen px-4 py-4 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">📦 My Catalog</h1>
          {products.length > 0 && (
            <span className="bg-brand-purple text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {products.length}
            </span>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full bg-white border border-gray-200 rounded-2xl h-11 px-4 text-sm outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-all shadow-card"
        />
      </div>

      {filtered.length === 0 && products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          message="Snap a photo and AI will create a listing for you"
          action="Add Product"
          onAction={() => navigate('/biz/snap')}
        />
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No products match "{search}"</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((product) => (
            <div key={product.id} className="bg-white rounded-2xl shadow-card p-3 flex gap-3 items-start">
              {product.images?.[0] ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Package className="h-6 w-6 text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm line-clamp-1">{product.name}</p>
                <p className="text-brand-purple font-bold mt-0.5">₹{product.price}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      product.is_available
                        ? 'bg-brand-green-light text-brand-green'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {product.is_available ? 'Active' : 'Hidden'}
                  </span>
                  {product.ai_generated && (
                    <span className="text-xs bg-brand-purple-light text-brand-purple px-2 py-0.5 rounded-full">✨ AI</span>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0">
                <button
                  onClick={() => navigate(`/biz/catalog/${product.id}/edit`)}
                  disabled={acting === product.id}
                  className="text-xs bg-brand-blue-light text-brand-blue px-3 py-1.5 rounded-xl font-medium disabled:opacity-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleToggle(product.id)}
                  disabled={acting === product.id}
                  className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-xl font-medium disabled:opacity-50"
                >
                  {product.is_available ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  disabled={acting === product.id}
                  className="text-xs bg-brand-red-light text-brand-red px-3 py-1.5 rounded-xl font-medium disabled:opacity-50"
                >
                  Del
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate('/biz/snap')}
        className="fixed bottom-24 right-4 w-14 h-14 bg-brand-purple rounded-full shadow-glow-purple flex items-center justify-center text-white text-2xl z-40 hover:bg-brand-purple-dark transition-colors active:scale-95"
      >
        +
      </button>
    </div>
  )
}
