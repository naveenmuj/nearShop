import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getWishlist, removeFromWishlist, getPriceDrops } from '../../api/wishlists'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { Heart, ShoppingBag, Trash2, TrendingDown } from 'lucide-react'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

export default function WishlistPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [priceDrops, setPriceDrops] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = async () => {
    setLoading(true); setError(null)
    try {
      const [wishlistRes, dropsRes] = await Promise.all([getWishlist(), getPriceDrops()])
      setItems(wishlistRes.data.items || wishlistRes.data || [])
      setPriceDrops(dropsRes.data.items || dropsRes.data || [])
    } catch (err) { setError(err.message || 'Failed to load wishlist') } finally { setLoading(false) }
  }
  useEffect(() => { fetchAll() }, [])

  const handleRemove = async (productId) => {
    try { await removeFromWishlist(productId); setItems(prev => prev.filter(item => (item.product_id || item.id) !== productId)); toast.success('Removed') }
    catch { toast.error('Failed to remove') }
  }

  const isPriceDrop = (item) => priceDrops.some(p => (p.product_id || p.id) === (item.product_id || item.id))

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>
  if (error) return <EmptyState icon={Heart} title="Could not load wishlist" message={error} action="Retry" onAction={fetchAll} />

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">My Wishlist</h1>
          {items.length > 0 && <span className="bg-brand-purple text-white text-xs font-bold px-2.5 py-0.5 rounded-full">{items.length}</span>}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20">
          <Heart className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No saved items yet</h3>
          <p className="text-sm text-gray-400 mt-2">Products you love will appear here</p>
          <button onClick={() => navigate('/app/search')} className="mt-6 bg-brand-purple text-white rounded-xl py-3 px-8 font-semibold text-sm hover:bg-brand-purple-dark transition">
            Discover Products
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
          {items.map(item => {
            const product = item.product || item
            const pid = item.product_id || item.id
            const drop = isPriceDrop(item)
            const discount = product.compare_price > product.price ? Math.round((1 - product.price / product.compare_price) * 100) : null
            return (
              <div key={pid} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all group relative">
                {/* Remove button */}
                <button onClick={() => handleRemove(pid)}
                  className="absolute top-2 right-2 z-10 w-8 h-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition hover:bg-red-50">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>

                <button onClick={() => navigate(`/app/product/${pid}`)} className="w-full text-left">
                  <div className="aspect-square bg-gray-50 relative overflow-hidden">
                    {product.images?.[0] || product.image ? (
                      <img src={product.images?.[0] || product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ShoppingBag className="w-10 h-10 text-gray-200" /></div>
                    )}
                    {discount && <span className="absolute top-2 left-2 bg-brand-red text-white text-[10px] font-bold px-2 py-0.5 rounded-lg">{discount}% OFF</span>}
                    {drop && (
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg">
                        <TrendingDown className="w-3 h-3" /> Price dropped!
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2">{product.name}</p>
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
    </div>
  )
}
