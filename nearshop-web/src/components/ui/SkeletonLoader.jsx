import React from 'react'

/**
 * SkeletonLoader - Beautiful loading skeleton for any content
 * Replaces boring spinners with realistic shimmer effect
 * 
 * Usage:
 * <SkeletonLoader type="card" count={3} />
 * <SkeletonLoader type="text" lines={3} />
 * <SkeletonLoader type="product" count={4} />
 */

export function SkeletonLoader({ type = 'card', count = 1, lines = 2, width = 'w-full', height = 'h-full' }) {
  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <div className={`${width} ${height} bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg animate-pulse`} />
        )

      case 'text':
        return (
          <div className="space-y-2">
            {[...Array(lines)].map((_, i) => (
              <div
                key={i}
                className={`h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded ${i === lines - 1 ? 'w-3/4' : 'w-full'} animate-pulse`}
              />
            ))}
          </div>
        )

      case 'product':
        return (
          <div className="bg-white rounded-lg overflow-hidden shadow-sm">
            {/* Image skeleton */}
            <div className="aspect-square bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
            {/* Content skeleton */}
            <div className="p-3 space-y-2">
              <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-3/4 animate-pulse" />
              <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-1/2 animate-pulse" />
              <div className="flex gap-2 pt-2">
                <div className="h-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-1/3 animate-pulse" />
                <div className="h-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-1/3 animate-pulse" />
              </div>
            </div>
          </div>
        )

      case 'shop':
        return (
          <div className="bg-white rounded-lg overflow-hidden shadow-sm">
            {/* Banner skeleton */}
            <div className="w-full h-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
            {/* Info skeleton */}
            <div className="p-3 space-y-2">
              <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-2/3 animate-pulse" />
              <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-1/2 animate-pulse" />
              <div className="flex gap-2 pt-2">
                <div className="h-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-1/4 animate-pulse" />
                <div className="h-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-1/4 animate-pulse" />
              </div>
            </div>
          </div>
        )

      case 'avatar':
        return (
          <div className="w-10 h-10 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-full animate-pulse" />
        )

      case 'button':
        return (
          <div className="h-10 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg animate-pulse w-full" />
        )

      case 'order':
        return (
          <div className="bg-white rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-1/4 animate-pulse" />
              <div className="h-4 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-1/4 animate-pulse" />
            </div>
            <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-1/2 animate-pulse" />
            <div className="h-3 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded w-2/3 animate-pulse" />
          </div>
        )

      default:
        return (
          <div className={`${width} ${height} bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-lg animate-pulse`} />
        )
    }
  }

  return (
    <div className="space-y-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="animate-fade-in">
          {renderSkeleton()}
        </div>
      ))}
    </div>
  )
}

/**
 * SkeletonGrid - Multiple skeletons in grid layout
 */
export function SkeletonGrid({ type = 'product', count = 4, columns = 2 }) {
  return (
    <div className={`grid grid-cols-${columns} gap-4 md:grid-cols-${columns === 2 ? 3 : columns}`}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className="animate-fade-in">
          <SkeletonLoader type={type} />
        </div>
      ))}
    </div>
  )
}

/**
 * SkeletonList - Skeletons in list layout
 */
export function SkeletonList({ count = 5, type = 'order' }) {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }}>
          <SkeletonLoader type={type} />
        </div>
      ))}
    </div>
  )
}

export default SkeletonLoader
