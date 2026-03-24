export default function ShopCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Cover image */}
      <div className="skeleton-shimmer aspect-[4/3] w-full" />
      {/* Info */}
      <div className="p-3 space-y-2">
        <div className="skeleton-shimmer h-4 rounded-md w-2/3" />
        <div className="skeleton-shimmer h-3 rounded-md w-1/2" />
        <div className="skeleton-shimmer h-3 rounded-md w-1/3" />
      </div>
    </div>
  )
}
