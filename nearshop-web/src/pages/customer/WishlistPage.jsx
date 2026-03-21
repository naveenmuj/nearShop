import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getWishlist, removeFromWishlist, getPriceDrops } from '../../api/wishlists'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { Heart } from 'lucide-react'

export default function WishlistPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [priceDrops, setPriceDrops] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    try {
      const [wishlistRes, dropsRes] = await Promise.all([
        getWishlist(),
        getPriceDrops(),
      ])
      setItems(wishlistRes.data.items || wishlistRes.data || [])
      setPriceDrops(dropsRes.data.items || dropsRes.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load wishlist')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const handleRemove = async (productId) => {
    try {
      await removeFromWishlist(productId)
      setItems((prev) => prev.filter((item) => (item.product_id || item.id) !== productId))
      toast.success('Removed from wishlist')
    } catch {
      toast.error('Failed to remove item')
    }
  }

  const isPriceDrop = (item) => {
    const pid = item.product_id || item.id
    return priceDrops.some((p) => (p.product_id || p.id) === pid)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold mb-4">❤️ My Wishlist</h1>
        <EmptyState icon={Heart} title="Could not load wishlist" message={error} action="Retry" onAction={fetchAll} />
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-6">
      {/* Header */}
      <div className="bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-100">
        <h1 className="font-bold text-xl text-gray-900">❤️ My Wishlist</h1>
        {items.length > 0 && (
          <span className="bg-brand-purple text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-8">
          <div className="text-7xl mb-4">🤍</div>
          <h3 className="text-xl font-semibold text-gray-700">No saved items yet</h3>
          <p className="text-sm text-gray-400 mt-2">Products you love will appear here</p>
          <button onClick={() => navigate('/app/search')} className="mt-6 bg-brand-purple text-white rounded-xl h-12 px-8 font-medium">
            Discover Products
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4">
          {items.map((item) => {
            const productId = item.product_id || item.id
            const hasPriceDrop = item.price_dropped || isPriceDrop(item)
            const image = item.product_images?.[0]
            return (
              <div key={item.id} className="bg-white rounded-2xl shadow-card overflow-hidden cursor-pointer hover:shadow-card-hover transition-all duration-200">
                <div className="relative aspect-[4/3]">
                  {image ? (
                    <img
                      src={image}
                      alt={item.product_name}
                      className="w-full h-full object-cover"
                      onClick={() => navigate(`/app/product/${productId}`)}
                    />
                  ) : (
                    <div
                      className="w-full h-full bg-gray-100"
                      onClick={() => navigate(`/app/product/${productId}`)}
                    />
                  )}
                  <button
                    onClick={() => handleRemove(productId)}
                    className="absolute top-2 right-2 w-7 h-7 bg-brand-red/90 rounded-full flex items-center justify-center text-white text-xs shadow-sm"
                  >
                    ✕
                  </button>
                  {hasPriceDrop && (
                    <span className="absolute top-2 left-2 bg-brand-green text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                      Price Drop!
                    </span>
                  )}
                </div>
                <div className="p-3" onClick={() => navigate(`/app/product/${productId}`)}>
                  <p className="text-sm font-medium text-gray-800 line-clamp-2">{item.product_name}</p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="font-bold text-gray-900">₹{item.product_price}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
