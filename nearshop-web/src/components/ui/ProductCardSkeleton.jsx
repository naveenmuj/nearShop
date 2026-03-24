export default function ProductCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Image */}
      <div className="skeleton-shimmer aspect-square w-full" />
      {/* Info */}
      <div className="p-3 space-y-2">
        <div className="skeleton-shimmer h-4 rounded-md w-3/4" />
        <div className="skeleton-shimmer h-4 rounded-md w-1/2" />
        <div className="skeleton-shimmer h-5 rounded-md w-1/3" />
        <div className="skeleton-shimmer h-3 rounded-md w-2/3" />
      </div>
    </div>
  )
}
