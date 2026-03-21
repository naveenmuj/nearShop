export const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 rounded-xl ${className}`} />
)

export const ProductCardSkeleton = () => (
  <div className="bg-white rounded-2xl shadow-card overflow-hidden">
    <div className="animate-pulse bg-gray-200 h-40 w-full" />
    <div className="p-3 space-y-2">
      <div className="animate-pulse bg-gray-200 rounded-xl h-4 w-3/4" />
      <div className="animate-pulse bg-gray-200 rounded-xl h-5 w-1/3" />
      <div className="animate-pulse bg-gray-200 rounded-xl h-3 w-1/2" />
    </div>
  </div>
)

export const ShopCardSkeleton = () => (
  <div className="bg-white rounded-2xl shadow-card p-4 flex gap-3">
    <div className="animate-pulse bg-gray-200 rounded-xl w-16 h-16 flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="animate-pulse bg-gray-200 rounded-xl h-4 w-2/3" />
      <div className="animate-pulse bg-gray-200 rounded-xl h-3 w-1/2" />
      <div className="animate-pulse bg-gray-200 rounded-xl h-3 w-1/3" />
    </div>
  </div>
)

export default Skeleton
