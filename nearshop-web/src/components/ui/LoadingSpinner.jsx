/**
 * LoadingSpinner - Beautiful, animated loading spinner with multiple variants
 * 
 * Usage:
 * <LoadingSpinner size="md" variant="spinner" />
 * <LoadingSpinner size="lg" variant="dots" />
 * <LoadingSpinner size="md" variant="bars" fullScreen message="Loading..." />
 */

export default function LoadingSpinner({ 
  size = 'md', 
  variant = 'spinner', 
  message = null, 
  fullScreen = false,
  className = ''
}) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  }

  const containerClass = fullScreen
    ? 'fixed inset-0 flex items-center justify-center bg-white bg-opacity-50 z-50'
    : 'flex items-center justify-center'

  return (
    <div className={`${containerClass} ${className}`}>
      <div className="flex flex-col items-center gap-3">
        {variant === 'spinner' && (
          <div className={`${sizeClasses[size]} border-4 border-gray-200 border-t-purple-600 rounded-full animate-spin`} />
        )}

        {variant === 'dots' && (
          <div className="flex gap-2">
            <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <div className="w-3 h-3 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
          </div>
        )}

        {variant === 'bars' && (
          <div className="flex gap-1 items-end justify-center">
            <div className="w-1 bg-purple-600 rounded-full" style={{ height: '24px', animation: 'pulse 1s ease-in-out infinite', animationDelay: '0s' }} />
            <div className="w-1 bg-purple-600 rounded-full" style={{ height: '32px', animation: 'pulse 1s ease-in-out infinite', animationDelay: '0.2s' }} />
            <div className="w-1 bg-purple-600 rounded-full" style={{ height: '28px', animation: 'pulse 1s ease-in-out infinite', animationDelay: '0.4s' }} />
          </div>
        )}

        {variant === 'pulse' && (
          <div className={`${sizeClasses[size]} bg-purple-600 rounded-lg animate-pulse`} />
        )}

        {variant === 'ring' && (
          <div className="relative">
            <div className={`${sizeClasses[size]} border-4 border-purple-600 rounded-full`} />
            <div 
              className={`${sizeClasses[size]} border-4 border-transparent border-t-purple-300 rounded-full absolute top-0 left-0 animate-spin`} 
              style={{ animationDirection: 'reverse' }} 
            />
          </div>
        )}

        {message && (
          <p className="text-sm text-gray-600 mt-2">{message}</p>
        )}
      </div>
    </div>
  )
}

/**
 * ProgressBar - Animated progress bar
 */
export function ProgressBar({ value = 0, max = 100, animated = true, showLabel = false, color = 'purple' }) {
  const percentage = Math.min((value / max) * 100, 100)

  const colorClasses = {
    purple: 'bg-purple-600',
    green: 'bg-green-600',
    blue: 'bg-blue-600',
    red: 'bg-red-600'
  }

  return (
    <div className="w-full">
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-full ${colorClasses[color]} transition-all duration-500 ease-out ${animated ? 'animate-pulse' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-gray-600 mt-1">{Math.round(percentage)}%</p>
      )}
    </div>
  )
}

/**
 * PulseLoader - Pulsing dots loader
 */
export function PulseLoader({ count = 3, size = 'sm' }) {
  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  }

  return (
    <div className="flex gap-2 items-center justify-center">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className={`${sizeClasses[size]} bg-purple-600 rounded-full animate-pulse`}
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  )
}
