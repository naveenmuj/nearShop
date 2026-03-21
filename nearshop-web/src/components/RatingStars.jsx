import { Star, StarHalf } from 'lucide-react'

export default function RatingStars({ rating = 0, size = 'md', className = '' }) {
  const sizes = { sm: 'h-3.5 w-3.5', md: 'h-5 w-5', lg: 'h-6 w-6' }
  const iconSize = sizes[size] || sizes.md
  const clamped = Math.min(5, Math.max(0, rating))
  const fullStars = Math.floor(clamped)
  const hasHalf = clamped - fullStars >= 0.25 && clamped - fullStars < 0.75
  const extraFull = clamped - fullStars >= 0.75 ? 1 : 0
  const totalFull = fullStars + extraFull
  const emptyStars = 5 - totalFull - (hasHalf ? 1 : 0)

  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`}>
      {Array.from({ length: totalFull }, (_, i) => (
        <Star key={`full-${i}`} className={`${iconSize} fill-yellow-400 text-yellow-400`} />
      ))}
      {hasHalf && <StarHalf className={`${iconSize} fill-yellow-400 text-yellow-400`} />}
      {Array.from({ length: emptyStars }, (_, i) => (
        <Star key={`empty-${i}`} className={`${iconSize} text-gray-300`} />
      ))}
    </div>
  )
}
