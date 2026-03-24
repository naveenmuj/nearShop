export default function OrderCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="skeleton-shimmer h-3 rounded-md w-24" />
          <div className="skeleton-shimmer h-4 rounded-md w-40" />
          <div className="skeleton-shimmer h-3 rounded-md w-32" />
        </div>
        <div className="space-y-2 text-right">
          <div className="skeleton-shimmer h-6 rounded-full w-20 ml-auto" />
          <div className="skeleton-shimmer h-5 rounded-md w-16 ml-auto" />
        </div>
      </div>
      <div className="skeleton-shimmer h-9 rounded-lg w-full" />
    </div>
  )
}
