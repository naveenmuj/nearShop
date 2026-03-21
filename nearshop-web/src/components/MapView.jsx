import { MapPin } from 'lucide-react'

export default function MapView({ className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl py-16 px-4 text-center ${className}`}>
      <MapPin className="h-12 w-12 text-primary-300 mb-3" />
      <h3 className="text-lg font-medium text-gray-700">Map view coming soon</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-xs">
        Interactive map with nearby shops will be available once a map library (Leaflet / Mapbox) is integrated.
      </p>
    </div>
  )
}
