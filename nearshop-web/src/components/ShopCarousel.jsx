import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef } from 'react'
import ShopCard from './ShopCard'

/**
 * ShopCarousel - Horizontal scrollable carousel of shops with animations
 * Usage: <ShopCarousel shops={shops} title="Shops Near You" />
 */
export default function ShopCarousel({ shops = [], title, loading = false, onLoadMore, distance_km_map = {} }) {
  const scrollRef = useRef(null)

  const scroll = (direction) => {
    if (!scrollRef.current) return
    const scrollAmount = 400
    const newPosition = direction === 'left'
      ? scrollRef.current.scrollLeft - scrollAmount
      : scrollRef.current.scrollLeft + scrollAmount
    scrollRef.current.scrollTo({ left: newPosition, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-6 bg-gray-200 rounded-lg w-40 animate-pulse" />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex-shrink-0 w-80 h-96 bg-gray-200 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  if (!shops || shops.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button className="text-blue-600 text-sm font-semibold hover:underline">
            View All
          </button>
        </div>
      )}

      <div className="relative group">
        {/* Left Scroll Button */}
        <button
          onClick={() => scroll('left')}
          className="
            absolute -left-4 top-1/2 -translate-y-1/2 z-10
            bg-white border border-gray-300 rounded-full p-2
            shadow-lg hover:bg-gray-50 transition-all
            opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0
            transition-all duration-300
          "
          aria-label="Scroll left"
        >
          <ChevronLeft size={24} className="text-gray-700" />
        </button>

        {/* Carousel Container */}
        <div
          ref={scrollRef}
          className="
            flex gap-4 overflow-x-auto pb-2 scroll-smooth
            scrollbar-hide snap-x snap-mandatory
          "
          style={{ scrollBehavior: 'smooth' }}
        >
          {shops.map((shop, index) => (
            <div
              key={shop.id || index}
              className="flex-shrink-0 w-80 snap-start"
              style={{
                animation: `slideIn 0.5s ease-out ${index * 0.1}s both`,
              }}
            >
              <ShopCard
                shop={shop}
                distance={distance_km_map[shop.id] || null}
                showDeliveryInfo={true}
              />
            </div>
          ))}
        </div>

        {/* Right Scroll Button */}
        <button
          onClick={() => scroll('right')}
          className="
            absolute -right-4 top-1/2 -translate-y-1/2 z-10
            bg-white border border-gray-300 rounded-full p-2
            shadow-lg hover:bg-gray-50 transition-all
            opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0
            transition-all duration-300
          "
          aria-label="Scroll right"
        >
          <ChevronRight size={24} className="text-gray-700" />
        </button>
      </div>

      {/* Load More Button */}
      {onLoadMore && (
        <div className="text-center">
          <button
            onClick={onLoadMore}
            className="
              inline-block px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600
              text-white rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700
              transition-all transform hover:scale-105 shadow-md
            "
          >
            Load More Shops
          </button>
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  )
}
