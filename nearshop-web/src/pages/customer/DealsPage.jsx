import { useState, useEffect } from 'react'
import { Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { getNearbyDeals, claimDeal } from '../../api/deals'
import { useLocation } from '../../hooks/useLocation'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

function getTimeLeft(expiresAt) {
  if (!expiresAt) return null
  const diff = new Date(expiresAt) - new Date()
  if (diff <= 0) return 'Expired'
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function DealsPage() {
  const { latitude, longitude } = useLocation()
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timers, setTimers] = useState({})
  const [claiming, setClaiming] = useState(null)

  const fetchDeals = async () => {
    if (!latitude || !longitude) return
    setLoading(true)
    setError(null)
    try {
      const { data } = await getNearbyDeals(latitude, longitude, { limit: 20 })
      setDeals(data.items || data || [])
    } catch (err) {
      setError(err.message || 'Failed to load deals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDeals()
  }, [latitude, longitude])

  useEffect(() => {
    if (deals.length === 0) return
    const interval = setInterval(() => {
      const newTimers = {}
      deals.forEach((d) => {
        newTimers[d.id] = getTimeLeft(d.expires_at)
      })
      setTimers(newTimers)
    }, 1000)
    return () => clearInterval(interval)
  }, [deals])

  const handleClaim = async (dealId) => {
    setClaiming(dealId)
    try {
      await claimDeal(dealId)
      toast.success('Deal claimed!')
      setDeals((prev) => prev.filter((d) => d.id !== dealId))
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to claim deal')
    } finally {
      setClaiming(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-50 min-h-screen px-4 py-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6">
          <h1 className="text-xl font-bold text-gray-900">Live Deals</h1>
          <span className="inline-block w-2 h-2 bg-brand-red rounded-full animate-pulse" />
        </div>
        <EmptyState icon={Zap} title="Could not load deals" message={error} action="Retry" onAction={fetchDeals} />
      </div>
    )
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white px-4 pt-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-gray-900">Live Deals</h1>
          <span className="inline-block w-2 h-2 bg-brand-red rounded-full animate-pulse" />
        </div>
        <button className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
          <span className="text-gray-500 text-sm">⚙️</span>
        </button>
      </div>

      <div className="px-4 pt-4 pb-6">
        {deals.length === 0 ? (
          <EmptyState icon={Zap} title="No deals yet" message="Deals from nearby shops will appear here" />
        ) : (
          <div className="flex flex-col gap-3">
            {deals.map((deal) => {
              const timeLeft = timers[deal.id] || getTimeLeft(deal.expires_at)
              return (
                <div key={deal.id} className="bg-white rounded-2xl shadow-card p-4 flex gap-3 items-start">
                  <div className="relative flex-shrink-0">
                    {deal.image_url ? (
                      <img
                        src={deal.image_url}
                        alt={deal.title}
                        className="w-20 h-20 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-brand-purple-light flex items-center justify-center">
                        <Zap className="w-8 h-8 text-brand-purple" />
                      </div>
                    )}
                    {deal.discount_pct > 0 && (
                      <div className="absolute -top-1 -left-1 bg-brand-red text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                        -{deal.discount_pct}%
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm line-clamp-2">{deal.title}</p>
                    {deal.shop_name && (
                      <p className="text-xs text-gray-400 mt-0.5">{deal.shop_name}</p>
                    )}
                    {(deal.deal_price || deal.original_price) && (
                      <div className="flex items-baseline gap-2 mt-1.5">
                        {deal.deal_price && (
                          <span className="text-base font-bold text-gray-900">₹{deal.deal_price}</span>
                        )}
                        {deal.original_price && (
                          <span className="text-xs text-gray-400 line-through">₹{deal.original_price}</span>
                        )}
                      </div>
                    )}
                    {deal.expires_at && timeLeft && (
                      <div className="flex items-center gap-1 mt-2">
                        <span className="text-xs text-brand-red">⏱</span>
                        <span className="text-xs font-mono font-bold text-brand-red">{timeLeft}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleClaim(deal.id)}
                    disabled={claiming === deal.id}
                    className="flex-shrink-0 bg-brand-purple text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-brand-purple-dark transition-colors disabled:opacity-50"
                  >
                    {claiming === deal.id ? 'Claiming...' : 'Claim'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
