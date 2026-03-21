import { useState, useEffect } from 'react'
import { Clock, Percent } from 'lucide-react'
import Badge from './ui/Badge'

function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(() => calcRemaining(expiresAt))

  useEffect(() => {
    if (!expiresAt) return
    const interval = setInterval(() => {
      setRemaining(calcRemaining(expiresAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [expiresAt])

  return remaining
}

function calcRemaining(expiresAt) {
  if (!expiresAt) return null
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return { expired: true, text: 'Expired' }

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff / (1000 * 60)) % 60)
  const seconds = Math.floor((diff / 1000) % 60)

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return { expired: false, text: `${days}d ${hours % 24}h left` }
  }
  return { expired: false, text: `${hours}h ${minutes}m ${seconds}s left` }
}

export default function DealBanner({ deal, onClick, className = '' }) {
  const {
    title,
    shop_name,
    discount_percent,
    discount_label,
    image_url,
    expires_at,
  } = deal

  const countdown = useCountdown(expires_at)

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow min-h-[100px] ${className}`}
    >
      {/* Deal image / color accent */}
      <div className="flex-shrink-0 w-28 h-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center self-stretch">
        {image_url ? (
          <img src={image_url} alt={title} className="w-full h-full object-cover" />
        ) : (
          <Percent className="h-10 w-10 text-white" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-3 min-w-0">
        {/* Discount badge */}
        {(discount_percent || discount_label) && (
          <Badge variant="danger" className="mb-1.5">
            {discount_label ?? `${discount_percent}% OFF`}
          </Badge>
        )}

        <h4 className="font-semibold text-gray-900 text-sm truncate">{title}</h4>
        {shop_name && <p className="text-xs text-gray-500 mt-0.5 truncate">{shop_name}</p>}

        {/* Countdown */}
        {countdown && (
          <div className={`inline-flex items-center gap-1 mt-2 text-xs font-medium ${countdown.expired ? 'text-gray-400' : 'text-secondary-600'}`}>
            <Clock className="h-3.5 w-3.5" />
            {countdown.text}
          </div>
        )}
      </div>
    </div>
  )
}
