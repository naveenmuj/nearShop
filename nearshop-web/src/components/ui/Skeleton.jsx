/**
 * Base Skeleton component with shimmer animation.
 * Props: variant ('text'|'rect'|'circle'|'image'), width, height, borderRadius, className, count
 */
export default function Skeleton({
  variant = 'rect',
  width,
  height,
  borderRadius,
  className = '',
  count = 1,
}) {
  const baseStyle = {
    width: width || undefined,
    height: height || undefined,
    borderRadius: borderRadius || undefined,
  }

  const variantClass = {
    text:   'h-4 rounded-md w-full',
    rect:   'rounded-xl',
    circle: 'rounded-full',
    image:  'rounded-xl aspect-square w-full',
  }[variant] || 'rounded-xl'

  const items = Array.from({ length: count })

  if (count === 1) {
    return (
      <div
        className={`skeleton-shimmer ${variantClass} ${className}`}
        style={baseStyle}
      />
    )
  }

  return (
    <div className="space-y-2">
      {items.map((_, i) => (
        <div
          key={i}
          className={`skeleton-shimmer ${variantClass} ${className}`}
          style={baseStyle}
        />
      ))}
    </div>
  )
}
