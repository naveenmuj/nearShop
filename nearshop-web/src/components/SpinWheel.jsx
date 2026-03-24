import { useState, useRef, useEffect } from 'react'
import { getDailySpinStatus, performDailySpin } from '../api/engagement'

const SEGMENTS = [
  { label: '5 Coins',   coins: 5,    color: '#7F77DD', textColor: '#fff' },
  { label: '10 Coins',  coins: 10,   color: '#1D9E75', textColor: '#fff' },
  { label: '20 Coins',  coins: 20,   color: '#EF9F27', textColor: '#fff' },
  { label: '50 Coins',  coins: 50,   color: '#E24B4A', textColor: '#fff' },
  { label: '100 Coins', coins: 100,  color: '#38BDF8', textColor: '#fff' },
  { label: '2× Boost',  coins: 0,    color: '#FDA7DF', textColor: '#333' },
  { label: '200 Coins', coins: 200,  color: '#FCD34D', textColor: '#333' },
]
const SEG_COUNT   = SEGMENTS.length
const SEG_ANGLE   = 360 / SEG_COUNT

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

export default function SpinWheel({ onWin }) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [prize, setPrize]   = useState(null)
  const [status, setStatus] = useState(null) // { can_spin, next_spin_at }
  const [loadingStatus, setLoadingStatus] = useState(true)
  const currentRotRef = useRef(0)

  useEffect(() => {
    getDailySpinStatus()
      .then(({ data }) => setStatus(data))
      .catch(() => setStatus({ can_spin: true }))
      .finally(() => setLoadingStatus(false))
  }, [])

  const formatCountdown = (isoString) => {
    const diff = Math.max(0, new Date(isoString) - Date.now())
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return `${h}h ${m}m`
  }

  const handleSpin = async () => {
    if (spinning || !status?.can_spin) return
    setSpinning(true)
    setPrize(null)

    try {
      const { data } = await performDailySpin()
      const segIdx = data.segment_index ?? 0

      // Calculate target rotation: land on segment + extra full spins (5+)
      // Wheel segments start at top (-90°). Segment 0 center is at -90+SEG_ANGLE/2.
      // We want segIdx center under the pointer (top = -90deg in SVG)
      const extraSpins = 5
      const segCenter = segIdx * SEG_ANGLE + SEG_ANGLE / 2
      // pointer is at 270deg (top in SVG coords). We need -segCenter to align
      const targetAngle = extraSpins * 360 + (270 - segCenter)
      const finalRotation = currentRotRef.current + targetAngle

      setRotation(finalRotation)
      currentRotRef.current = finalRotation

      // After animation completes (4s)
      setTimeout(() => {
        setPrize({ ...SEGMENTS[segIdx], segment_index: segIdx, data })
        setStatus(prev => ({ ...prev, can_spin: false, next_spin_at: data.next_spin_at }))
        setSpinning(false)
        onWin?.(data)
      }, 4200)
    } catch {
      setSpinning(false)
    }
  }

  const CX = 150; const CY = 150; const R = 140

  return (
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
          className="spin-wheel-transition"
          style={{ transform: `rotate(${rotation}deg)`, transformOrigin: 'center' }}
        >
          <svg width="300" height="300" viewBox="0 0 300 300">
            {SEGMENTS.map((seg, i) => {
              const startDeg = i * SEG_ANGLE - 90
              const endDeg   = startDeg + SEG_ANGLE
              const midDeg   = startDeg + SEG_ANGLE / 2
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
            {/* Center circle */}
            <circle cx={CX} cy={CY} r="20" fill="#fff" stroke="#e5e7eb" strokeWidth="2" />
            <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="800" fill="#7F77DD">SPIN</text>
          </svg>
        </div>
      </div>

      {/* Prize display */}
      {prize && (
        <div className="text-center animate-bounce">
          <p className="text-2xl font-extrabold text-brand-amber">
            {prize.coins > 0 ? `+${prize.coins} Coins!` : prize.label}
          </p>
          <p className="text-sm text-gray-500 mt-1">Reward added to your wallet</p>
        </div>
      )}

      {/* Spin button */}
      {!loadingStatus && (
        <>
          {status?.can_spin ? (
            <button
              onClick={handleSpin}
              disabled={spinning}
              className="px-10 py-3 bg-gradient-to-r from-brand-purple to-purple-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all disabled:opacity-60 disabled:scale-100"
            >
              {spinning ? 'Spinning...' : 'SPIN!'}
            </button>
          ) : (
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-600">Already spun today!</p>
              {status?.next_spin_at && (
                <p className="text-xs text-gray-400 mt-1">
                  Next spin in {formatCountdown(status.next_spin_at)}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
