import { useState, useEffect } from 'react'
import { Star, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'
import { getBalance, getCoinHistory, getBadges, getStreak, dailyCheckin } from '../../api/loyalty'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function WalletPage() {
  const [balance, setBalance] = useState(0)
  const [history, setHistory] = useState([])
  const [badges, setBadges] = useState([])
  const [streak, setStreak] = useState(null)
  const [loading, setLoading] = useState(true)
  const [checkingIn, setCheckingIn] = useState(false)
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [balRes, histRes, badgesRes, streakRes] = await Promise.all([
        getBalance(),
        getCoinHistory(),
        getBadges(),
        getStreak(),
      ])
      setBalance(balRes.data.balance || balRes.data.coins || 0)
      setHistory(histRes.data.items || histRes.data || [])
      setBadges(badgesRes.data.items || badgesRes.data || [])
      setStreak(streakRes.data)
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const handleCheckIn = async () => {
    setCheckingIn(true)
    try {
      const { data } = await dailyCheckin()
      const earned = data.coins_earned || data.coins || 0
      toast.success(`Daily check-in! +${earned} NearCoins`)
      setAlreadyCheckedIn(true)
      fetchAll()
    } catch (err) {
      const detail = err.response?.data?.detail || ''
      if (detail.toLowerCase().includes('already')) {
        setAlreadyCheckedIn(true)
      }
      toast.error(detail || 'Already checked in today')
    } finally {
      setCheckingIn(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const currentStreak = streak?.current_streak || 0

  return (
    <div className="">
      {/* Balance card */}
      <div className="mx-4 mt-4 rounded-3xl p-6 text-white" style={{background: 'linear-gradient(135deg, #EF9F27, #D85A30)'}}>
        <p className="text-white/70 text-sm font-medium">ShopCoins Balance</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-5xl font-bold">{balance}</span>
          <span className="text-2xl">🪙</span>
        </div>
        <div className="flex items-center gap-2 mt-3 text-white/80 text-sm">
          <span>🔥 {currentStreak} day streak</span>
        </div>
      </div>

      {/* Check-in button */}
      <div className="mx-4 mt-4">
        <button
          onClick={handleCheckIn}
          disabled={alreadyCheckedIn || checkingIn}
          className={`w-full h-12 rounded-xl font-semibold text-sm transition-all ${alreadyCheckedIn ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-brand-amber text-white hover:bg-brand-amber/90 active:scale-[0.98]'}`}
        >
          {checkingIn ? 'Checking in...' : alreadyCheckedIn ? '✓ Checked in today' : '🎁 Daily Check-in (+10 coins)'}
        </button>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="mx-4 mt-4 bg-white rounded-2xl shadow-card p-4">
          <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-brand-amber" />
            Badges
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {badges.map((badge) => (
              <div key={badge.id || badge.slug} className="flex-shrink-0 flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full bg-brand-amber-light border-2 border-brand-amber/30 flex items-center justify-center text-xl">
                  {badge.emoji || <Star className="h-5 w-5 text-brand-amber" />}
                </div>
                <span className="text-xs text-gray-500 text-center w-14 truncate">{badge.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction history */}
      <div className="mx-4 mt-4 bg-white rounded-2xl shadow-card p-4">
        <h2 className="text-base font-semibold text-gray-800 mb-2">Coin History</h2>
        {history.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">Earn ShopCoins by shopping and daily check-ins</p>
        ) : (
          <div>
            {history.map((txn, idx) => (
              <div key={txn.id || idx} className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${txn.amount > 0 ? 'bg-brand-green-light' : 'bg-brand-red-light'}`}>
                  <span>{txn.amount > 0 ? '⬆️' : '⬇️'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{txn.reason || txn.description || 'Transaction'}</p>
                  <p className="text-xs text-gray-400">{formatDate(txn.created_at)}</p>
                </div>
                <span className={`font-bold text-sm ${txn.amount > 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                  {txn.amount > 0 ? '+' : ''}{txn.amount} 🪙
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
