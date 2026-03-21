import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { getNearbyShops } from '../../api/shops'
import { useLocationStore } from '../../store/locationStore'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

export default function ShopsMapPage() {
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { latitude, longitude } = useLocationStore()

  useEffect(() => {
    getNearbyShops(latitude || 0, longitude || 0, { limit: 50 })
      .then(({ data }) => setShops(data.items || data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [latitude, longitude])

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Shops Near You</h1>
      {loading && (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      )}
      {shops.length === 0 && !loading && (
        <p className="text-gray-400 text-center mt-10">No shops found nearby</p>
      )}
      <div className="flex flex-col gap-3">
        {shops.map((shop) => (
          <button
            key={shop.id}
            onClick={() => navigate(`/app/shop/${shop.id}`)}
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-3 text-left hover:border-purple-300 transition-colors"
          >
            <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <MapPin className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">{shop.name}</p>
              <p className="text-sm text-gray-500 truncate">{shop.address || shop.locality || ''}</p>
              {shop.distance_km != null && (
                <p className="text-xs text-purple-600 mt-0.5">{shop.distance_km.toFixed(1)} km away</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
