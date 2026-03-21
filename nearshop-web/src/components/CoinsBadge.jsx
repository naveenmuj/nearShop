import { Coins } from 'lucide-react'

export default function CoinsBadge({ balance = 0, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 bg-secondary-100 text-secondary-700 px-3 py-1 rounded-full text-sm font-medium ${className}`}>
      <Coins className="h-4 w-4" />
      <span>{balance.toLocaleString()}</span>
    </span>
  )
}
