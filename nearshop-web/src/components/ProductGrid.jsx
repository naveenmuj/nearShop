import { PackageSearch } from 'lucide-react'
import ProductCard from './ProductCard'
import LoadingSpinner from './ui/LoadingSpinner'
import EmptyState from './ui/EmptyState'

export default function ProductGrid({
  products = [],
  loading = false,
  emptyMessage = 'No products found',
  onWishlistToggle,
  onProductClick,
  className = '',
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!products.length) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="Nothing here yet"
        message={emptyMessage}
      />
    )
  }

  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 ${className}`}>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onWishlistToggle={onWishlistToggle}
          onClick={() => onProductClick?.(product)}
          className="cursor-pointer hover:shadow-md transition-shadow"
        />
      ))}
    </div>
  )
}
