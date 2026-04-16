import { useState, useEffect, useRef } from 'react'
import { Gift, Clock, Flame, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'
import { getDailySpinStatus, performDailySpin } from '../../api/engagement'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import { PageTransition } from '../../components/ui/PageTransition'

const SEGMENTS = [
  { label: '5 Coins',   coins: 5,    color: '#7F77DD', textColor: '#fff' },
  { label: '10 Coins',  coins: 10,   color: '#1D9E75', textColor: '#fff' },
  { label: '20 Coins',  coins: 20,   color: '#EF9F27', textColor: '#fff' },
  { label: '50 Coins',  coins: 50,   color: '#E24B4A', textColor: '#fff' },
  { label: '100 Coins', coins: 100,  color: '#38BDF8', textColor: '#fff' },
  { label: '2x Boost',  coins: 0,    color: '#FDA7DF', textColor: '#333' },
  { label: '200 Coins', coins: 200,  color: '#FCD34D', textColor: '#333' },
]
const SEG_COUNT = SEGMENTS.length
const SEG_ANGLE = 360 / SEG_COUNT

function buildWheelPath(cx, cy, r, startDeg, endDeg) {
  const toRad = (d) => (d * Math.PI) / 180
  const x1 = cx + r * Math.cos(toRad(startDeg))
  const y1 = cy + r * Math.sin(toRad(startDeg))
  const x2 = cx + r * Math.cos(toRad(endDeg))
  const y2 = cy + r * Math.sin(toRad(endDeg))
  const largeArc = endDeg - startDeg > 180 ? 1 : 0
  return `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`
}

function textPosition(cx, cy, r, midDeg) {
  const toRad = (d) => (d * Math.PI) / 180
  const tr = r * 0.65
  return {
    x: cx + tr * Math.cos(toRad(midDeg)),
    y: cy + tr * Math.sin(toRad(midDeg)),
  }
}

export default function SpinWheelPage() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [prize, setPrize] = useState(null)
  const [rotation, setRotation] = useState(0)
  const [countdown, setCountdown] = useState('')
  const currentRotRef = useRef(0)
  const countdownRef = useRef(null)

  // Fetch spin status on mount
  useEffect(() => {
    getDailySpinStatus()
      .then(({ data }) => setStatus(data))
      .catch(() => setStatus({ can_spin: true }))
      .finally(() => setLoading(false))
  }, [])

  // Countdown timer for next_spin_available / next_spin_at
  useEffect(() => {
    const nextSpin = status?.next_spin_available || status?.next_spin_at
    if (!nextSpin || status?.can_spin) {
      setCountdown('')
      return
    }

    const updateCountdown = () => {
      const diff = Math.max(0, new Date(nextSpin) - Date.now())
      if (diff <= 0) {
        setCountdown('')
        setStatus(prev => ({ ...prev, can_spin: true }))
        if (countdownRef.current) clearInterval(countdownRef.current)
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${h}h ${m}m ${s}s`)
    }

    updateCountdown()
    countdownRef.current = setInterval(updateCountdown, 1000)
    return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
  }, [status?.next_spin_available, status?.next_spin_at, status?.can_spin])

  const handleSpin = async () => {
    if (spinning || !status?.can_spin) return
    setSpinning(true)
    setPrize(null)

    try {
      const { data } = await performDailySpin()
      const segIdx = data.segment_index ?? Math.floor(Math.random() * SEG_COUNT)

      // Calculate target rotation
      const extraSpins = 5
      const segCenter = segIdx * SEG_ANGLE + SEG_ANGLE / 2
      const targetAngle = extraSpins * 360 + (270 - segCenter)
      const finalRotation = currentRotRef.current + targetAngle

      setRotation(finalRotation)
      currentRotRef.current = finalRotation

      // After animation completes
      setTimeout(() => {
        const coins = data.coins_earned ?? data.coins ?? SEGMENTS[segIdx]?.coins ?? 0
        const streak = data.streak ?? data.streak_days ?? 0
        setPrize({
          ...SEGMENTS[segIdx],
          coins,
          streak,
          data,
        })
        setStatus(prev => ({
          ...prev,
          can_spin: false,
          next_spin_available: data.next_spin_available || data.next_spin_at,
          next_spin_at: data.next_spin_at || data.next_spin_available,
        }))
        setSpinning(false)

        if (coins > 0) {
          toast.success(`You won ${coins} coins!`)
        } else {
          toast.success('You got a 2x Boost!')
        }
      }, 4200)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Spin failed. Try again.')
      setSpinning(false)
    }
  }

  const CX = 150; const CY = 150; const R = 140

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <PageTransition>
      <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Daily Spin</h1>
        <p className="text-gray-500 text-sm">Spin once every day to win coins and rewards!</p>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm">
        <div className="flex flex-col items-center gap-6">
          {/* Pointer arrow */}
          <div className="relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10" style={{ marginTop: '-12px' }}>
              <div
                className="w-0 h-0"
                style={{
                  borderLeft: '10px solid transparent',
                  borderRight: '10px solid transparent',
                  borderTop: '20px solid #7F77DD',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                }}
              />
            </div>

            {/* SVG Wheel */}
            <div
              style={{
                transform: `rotate(${rotation}deg)`,
                transformOrigin: 'center',
                transition: spinning ? 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none',
              }}
            >
              <svg width="300" height="300" viewBox="0 0 300 300">
                {SEGMENTS.map((seg, i) => {
                  const startDeg = i * SEG_ANGLE - 90
                  const endDeg = startDeg + SEG_ANGLE
                  const midDeg = startDeg + SEG_ANGLE / 2
                  const tp = textPosition(CX, CY, R, midDeg)

                  return (
                    <g key={i}>
                      <path
                        d={buildWheelPath(CX, CY, R, startDeg, endDeg)}
                        fill={seg.color}
                        stroke="#fff"
                        strokeWidth="2"
                      />
                      <text
                        x={tp.x}
                        y={tp.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={seg.textColor}
                        fontSize="10"
                        fontWeight="700"
                        transform={`rotate(${midDeg + 90}, ${tp.x}, ${tp.y})`}
                      >
                        {seg.label}
                      </text>
                    </g>
                  )
                })}
                <circle cx={CX} cy={CY} r="20" fill="#fff" stroke="#e5e7eb" strokeWidth="2" />
                <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="800" fill="#7F77DD">SPIN</text>
              </svg>
            </div>
          </div>

          {/* Prize result */}
          {prize && (
            <div className="text-center bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-5 border border-amber-200 w-full">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Trophy className="w-6 h-6 text-amber-500" />
                <p className="text-xl font-extrabold text-amber-700">
                  {prize.coins > 0 ? `+${prize.coins} Coins!` : '2x Boost Activated!'}
                </p>
              </div>
              {prize.streak > 0 && (
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-semibold text-orange-600">
                    {prize.streak} day streak!
                  </span>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">Reward added to your wallet</p>
            </div>
          )}

          {/* Spin button or countdown */}
          {status?.can_spin ? (
            <button
              onClick={handleSpin}
              disabled={spinning}
              className="px-10 py-3 bg-gradient-to-r from-brand-purple to-purple-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-60 disabled:scale-100"
            >
              {spinning ? 'Spinning...' : 'SPIN!'}
            </button>
          ) : (
            <div className="text-center bg-gray-50 rounded-xl p-4 w-full">
              <p className="text-sm font-semibold text-gray-600">Already spun today!</p>
              {countdown && (
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <p className="text-sm text-gray-500 font-mono">{countdown}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Streak info */}
      {status?.streak != null && status.streak > 0 && (
        <div className="mt-6 bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
          <Flame className="w-8 h-8 text-orange-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-orange-800">{status.streak} Day Streak</p>
            <p className="text-xs text-orange-600">Keep spinning daily to maintain your streak and earn bonus rewards!</p>
          </div>
        </div>
      )}

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <h3 className="text-sm font-bold text-amber-800 mb-2">How it works</h3>
        <ul className="space-y-1 text-xs text-amber-700">
          <li>Spin the wheel once every 24 hours</li>
          <li>Win coins that can be redeemed on purchases</li>
          <li>2x Boost doubles your next order's coin reward</li>
          <li>Build streaks for bonus rewards</li>
          <li>Check your wallet to see your coin balance</li>
        </ul>
      </div>
      </div>
    </PageTransition>
  )
}
