import { useState, useEffect, useRef } from 'react'
import { Search, SlidersHorizontal } from 'lucide-react'

export default function SearchBar({
  placeholder = 'Search shops & products...',
  onChange,
  onSubmit,
  debounceMs = 400,
  categories = [],
  locations = [],
  className = '',
}) {
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!onChange) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onChange({
        query,
        category: selectedCategory || undefined,
        location: selectedLocation || undefined,
      })
    }, debounceMs)
    return () => clearTimeout(debounceRef.current)
  }, [query, selectedCategory, selectedLocation, debounceMs])

  const handleSubmit = (e) => {
    e.preventDefault()
    clearTimeout(debounceRef.current)
    onSubmit?.({
      query,
      category: selectedCategory || undefined,
      location: selectedLocation || undefined,
    })
  }

  const hasFilters = categories.length > 0 || locations.length > 0

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <Search className="absolute left-3 h-5 w-5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-gray-300 bg-white pl-10 pr-12 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {hasFilters && (
          <button
            type="button"
            onClick={() => setShowFilters((p) => !p)}
            className={`absolute right-3 p-1 rounded-lg transition-colors ${showFilters ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        )}
      </form>

      {/* Filter dropdowns */}
      {showFilters && hasFilters && (
        <div className="flex gap-3 mt-2">
          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.value ?? cat} value={cat.value ?? cat}>
                  {cat.label ?? cat}
                </option>
              ))}
            </select>
          )}
          {locations.length > 0 && (
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.value ?? loc} value={loc.value ?? loc}>
                  {loc.label ?? loc}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  )
}
