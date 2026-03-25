import { MapPin, Truck, Clock, AlertCircle, CheckCircle } from 'lucide-react'

/**
 * DeliveryBadge - Shows shop delivery status with beautiful design
 * Usage: <DeliveryBadge deliveryInfo={info} />
 */
export default function DeliveryBadge({ deliveryInfo, compact = false }) {
  if (!deliveryInfo) return null

  const { can_deliver, distance_km, delivery_fee, reason, min_order } = deliveryInfo

  if (compact) {
    return (
      <div
        className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
          can_deliver
            ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
        }`}
      >
        {can_deliver ? (
          <>
            <CheckCircle size={14} />
            <span>Delivers</span>
          </>
        ) : (
          <>
            <AlertCircle size={14} />
            <span>No delivery</span>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-3">
        {can_deliver ? (
          <CheckCircle className="text-green-500 mt-0.5 flex-shrink-0" size={20} />
        ) : (
          <AlertCircle className="text-red-500 mt-0.5 flex-shrink-0" size={20} />
        )}

        <div className="flex-1">
          <p className={`font-semibold ${can_deliver ? 'text-green-700' : 'text-red-700'}`}>
            {reason}
          </p>

          {can_deliver && (
            <div className="mt-2 space-y-2 text-sm text-gray-700">
              <div className="flex items-center gap-2">
                <MapPin size={16} />
                <span>{distance_km} km away</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck size={16} />
                <span>
                  {delivery_fee === 0
                    ? 'Free delivery'
                    : `₹${delivery_fee} delivery`}
                </span>
                {min_order && (
                  <span className="text-gray-500 text-xs">
                    (Min order: ₹{min_order})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
