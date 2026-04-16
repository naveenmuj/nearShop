import { useState, useEffect } from 'react'
import { Zap, Clock, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { getNearbyDeals, claimDeal } from '../../api/deals'
import { getPersonalisedDeals } from '../../api/ai'
import { useLocation } from '../../hooks/useLocation'
import { useAuthStore } from '../../store/authStore'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'
import { PageTransition } from '../../components/ui/PageTransition'

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN')

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
  const { isAuthenticated } = useAuthStore()
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [timers, setTimers] = useState({})
  const [claiming, setClaiming] = useState(null)

  const fetchDeals = async () => {
    if (!latitude || !longitude) return
    setLoading(true); setError(null)
    try {
      // Use personalised deals for authenticated users, fallback to nearby
      let result
      if (isAuthenticated) {
        try {
          const pRes = await getPersonalisedDeals(latitude, longitude, { limit: 20 })
          result = pRes.data?.deals ?? []
        } catch {
          const { data } = await getNearbyDeals(latitude, longitude, { limit: 20 })
          result = data.items || data || []
        }
      } else {
        const { data } = await getNearbyDeals(latitude, longitude, { limit: 20 })
        result = data.items || data || []
      }
      setDeals(result)
    } catch (err) { setError(err.message || 'Failed to load deals') } finally { setLoading(false) }
  }

  useEffect(() => { fetchDeals() }, [latitude, longitude, fetchDeals])
  useEffect(() => {
    if (deals.length === 0) return
    const interval = setInterval(() => { const t = {}; deals.forEach(d => { t[d.id] = getTimeLeft(d.expires_at) }); setTimers(t) }, 1000)
    return () => clearInterval(interval)
  }, [deals])

  const handleClaim = async (dealId) => {
    setClaiming(dealId)
    try { await claimDeal(dealId); toast.success('Deal claimed!'); setDeals(prev => prev.filter(d => d.id !== dealId)) }
    catch (err) { toast.error(err.response?.data?.detail || 'Failed to claim deal') } finally { setClaiming(null) }
  }

  if (loading) return <div className="flex items-center justify-center py-24"><LoadingSpinner size="lg" /></div>
  if (error) return <EmptyState icon={Zap} title="Could not load deals" message={error} action="Retry" onAction={fetchDeals} />

  return (
    <PageTransition>
      <div>
      {/* Hero banner */}
      <div className="bg-gradient-to-r from-brand-red to-brand-coral rounded-2xl p-6 lg:p-8 mb-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-6 h-6 fill-white" />
          <h1 className="text-2xl lg:text-3xl font-extrabold">Live Deals</h1>
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
        </div>
        <p className="text-sm opacity-80">Grab limited-time offers from shops near you</p>
      </div>

      {deals.length === 0 ? (
        <EmptyState icon={Zap} title="No deals right now" message="Deals from nearby shops will appear here" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-list">
          {deals.map((deal, idx) => {
            const timeLeft = timers[deal.id] || getTimeLeft(deal.expires_at)
            const expired = timeLeft === 'Expired'
            // Use savings_pct from API if available, otherwise calculate from prices
            const discount = deal.savings_pct ?? (deal.original_price && deal.deal_price ? Math.round((1 - deal.deal_price / deal.original_price) * 100) : deal.discount_pct ?? null)
            return (
              <div key={deal.id} className={`bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all animate-fade-in-up hover-lift smooth-transition ${expired ? 'opacity-50' : ''}`}
                style={{animationDelay: `${idx * 50}ms`}}>
                {/* Discount header */}
                <div className="bg-gradient-to-r from-brand-red to-brand-coral p-4 relative">
                  {discount && <p className="text-2xl font-extrabold text-white">{discount}% OFF</p>}
                  <div className="flex items-center gap-1.5 mt-1">
                    <Clock className="w-3 h-3 text-white/70" />
                    <span className={`text-xs font-semibold ${expired ? 'text-white/50' : 'text-white/90'}`}>{timeLeft}</span>
                  </div>
                </div>
                {/* Content */}
                <div className="p-4">
                  <p className="text-sm font-bold text-gray-900 line-clamp-2">{deal.product_name || deal.title || deal.name}</p>
                  <p className="text-xs text-brand-purple font-medium mt-1">{deal.shop_name}</p>
                  <div className="flex items-baseline gap-2 mt-2">
                    {deal.deal_price && <span className="text-lg font-extrabold text-gray-900">{formatPrice(deal.deal_price)}</span>}
                    {deal.original_price && deal.original_price > (deal.deal_price || 0) && (
                      <span className="text-sm text-gray-400 line-through">{formatPrice(deal.original_price)}</span>
                    )}
                  </div>
                  {deal.match_reason && <p className="text-xs text-purple-500 mt-1 flex items-center gap-1"><Sparkles className="w-3 h-3" />{deal.match_reason}</p>}
                  {deal.current_claims != null && <p className="text-xs text-gray-400 mt-1">{deal.current_claims} claimed</p>}
                  <button onClick={() => !expired && handleClaim(deal.id)} disabled={expired || claiming === deal.id}
                    className={`w-full mt-3 py-2.5 rounded-xl text-sm font-bold transition hover-scale smooth-transition ${expired ? 'bg-gray-100 text-gray-400' : 'bg-brand-purple text-white hover:bg-brand-purple-dark'}`}>
                    {expired ? 'Expired' : claiming === deal.id ? 'Claiming...' : 'Claim Deal'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
    </PageTransition>
  )
}
