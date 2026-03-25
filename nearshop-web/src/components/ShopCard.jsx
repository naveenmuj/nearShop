import { MapPin, Truck, ShoppingBag, Star, MessageSquare, Phone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import RatingStars from './RatingStars'
import Badge from './ui/Badge'

export default function ShopCard({ shop, onClick, className = '', distance = null, showDeliveryInfo = true }) {
  const navigate = useNavigate()
  const {
    id,
    name,
    category,
    rating,
    distance_km,
    delivery_available,
    pickup_available,
    image_url,
    cover_image,
    logo_url,
    delivery_options,
    is_open_now,
    delivery_fee,
    min_order,
    total_products,
    total_reviews,
    avg_rating,
    phone,
    whatsapp,
  } = shop

  const dist = distance || distance_km
  const deliveryMode = delivery_options?.includes('delivery') ? 'delivery' : 'pickup'
  const isOpenNow = is_open_now
  const rating_val = rating || avg_rating || 0

  const handleShopClick = () => {
    if (onClick) {
      onClick(shop)
    } else {
      navigate(`/customer/shop/${id}`)
    }
  }

  return (
    <div
      className={`
        group relative bg-white rounded-2xl shadow-md overflow-hidden cursor-pointer
        transition-all duration-300 hover:shadow-2xl
        hover:-translate-y-2 hover:scale-105
        ${className}
      `}
      onClick={handleShopClick}
      style={{
        animation: 'fadeInUp 0.6s ease-out',
      }}
    >
      {/* Cover Image with Overlay */}
      <div className="relative h-40 bg-gradient-to-br from-gray-200 to-gray-300 overflow-hidden">
        {cover_image || image_url ? (
          <img
            src={cover_image || image_url}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-500" />
        )}

        {/* Open Status Badge */}
        <div className="absolute top-3 right-3">
          <span
            className={`
              px-3 py-1 rounded-full text-xs font-bold
              ${
                isOpenNow
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-500 text-white'
              }
              shadow-lg
            `}
          >
            {isOpenNow ? '● Open' : 'Closed'}
          </span>
        </div>

        {/* Delivery Badge */}
        {showDeliveryInfo && (
          <div className="absolute bottom-3 left-3">
            <span
              className={`
                px-2 py-1 rounded text-xs font-semibold
                ${
                  deliveryMode === 'delivery'
                    ? 'bg-blue-500 text-white'
                    : 'bg-orange-500 text-white'
                }
              `}
            >
              {deliveryMode === 'delivery' ? '🚚 Delivery' : '🏪 Pickup'}
            </span>
          </div>
        )}
      </div>

      {/* Logo & Info */}
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          {logo_url && (
            <img
              src={logo_url}
              alt={name}
              className="w-12 h-12 rounded-lg object-cover shadow-md"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 truncate text-lg">
              {name}
            </h3>
            <p className="text-sm text-gray-600 truncate">
              {category || 'General Store'}
            </p>
          </div>
        </div>

        {/* Rating & Reviews */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1">
            <Star size={16} className="text-yellow-400 fill-yellow-400" />
            <span className="font-semibold text-gray-900">
              {rating_val.toFixed(1)}
            </span>
            <span className="text-xs text-gray-500">
              ({total_reviews || 0})
            </span>
          </div>
        </div>

        {/* Location & Distance */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
          <MapPin size={16} className="text-red-500 flex-shrink-0" />
          <span>
            {dist ? `${dist.toFixed(1)} km away` : 'Nearby'}
          </span>
        </div>

        {/* Delivery/Pickup Details */}
        <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2 text-sm">
          {deliveryMode === 'delivery' && (
            <div className="flex items-center gap-2 text-gray-700">
              <Truck size={16} />
              <span>
                {delivery_fee === 0 || delivery_fee === '0'
                  ? '🎉 Free delivery'
                  : `₹${delivery_fee} delivery`}
              </span>
            </div>
          )}

          {min_order && (
            <div className="flex items-center gap-2 text-gray-700">
              <span className="text-lg">🛒</span>
              <span>Min: ₹{min_order}</span>
            </div>
          )}

          {total_products && (
            <div className="flex items-center gap-2 text-gray-700">
              <span className="text-lg">📦</span>
              <span>{total_products} products</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {phone && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.open(`tel:${phone}`, '_self')
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
              title="Call shop"
            >
              <Phone size={16} />
            </button>
          )}
          {whatsapp && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.open(
                  `https://wa.me/${whatsapp.replace(/\D/g, '')}`,
                  '_blank'
                )
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
              title="Message on WhatsApp"
            >
              <MessageSquare size={16} />
            </button>
          )}
          <button
            onClick={handleShopClick}
            className="flex-1 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg hover:from-blue-600 hover:to-indigo-700 transition-all transform hover:scale-105 text-sm font-bold shadow-md"
          >
            Browse
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
