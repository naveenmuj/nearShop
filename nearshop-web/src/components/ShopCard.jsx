import { MapPin, Truck, ShoppingBag } from 'lucide-react'
import RatingStars from './RatingStars'
import Badge from './ui/Badge'

export default function ShopCard({ shop, onClick, className = '' }) {
  const {
    name,
    category,
    rating,
    distance_km,
    delivery_available,
    pickup_available,
    image_url,
  } = shop

  return (
    <div
      className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${className}`}
      onClick={onClick}
    >
      {/* Shop image */}
      <div className="relative h-36 bg-gray-100">
        {image_url ? (
          <img src={image_url} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="h-10 w-10 text-gray-300" />
          </div>
        )}
        {category && (
          <div className="absolute top-2 left-2">
            <Badge variant="primary">{category}</Badge>
          </div>
        )}
      </div>

      {/* Shop info */}
      <div className="px-4 py-3">
        <h3 className="font-semibold text-gray-900 truncate">{name}</h3>

        <div className="flex items-center gap-2 mt-1">
          <RatingStars rating={rating} size="sm" />
          {rating != null && (
            <span className="text-xs text-gray-500">{rating.toFixed(1)}</span>
          )}
        </div>

        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          {distance_km != null && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {distance_km < 1
                ? `${Math.round(distance_km * 1000)}m`
                : `${distance_km.toFixed(1)} km`}
            </span>
          )}

          <div className="flex items-center gap-2">
            {delivery_available && (
              <span className="inline-flex items-center gap-0.5 text-secondary-600">
                <Truck className="h-3.5 w-3.5" />
                Delivery
              </span>
            )}
            {pickup_available && (
              <span className="inline-flex items-center gap-0.5 text-primary-600">
                <ShoppingBag className="h-3.5 w-3.5" />
                Pickup
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
