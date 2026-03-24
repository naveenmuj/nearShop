import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// 20 confetti squares in random positions/colors
const CONFETTI_COLORS = ['#7F77DD', '#1D9E75', '#EF9F27', '#E24B4A', '#38BDF8', '#FDA7DF', '#FCD34D']

function Confetti() {
  const pieces = Array.from({ length: 20 }, (_, i) => {
    const left  = `${Math.random() * 100}%`
    const delay = `${Math.random() * 2}s`
    const dur   = `${2 + Math.random() * 2}s`
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    const size  = 8 + Math.floor(Math.random() * 8)
    return { left, delay, dur, color, size }
  })

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {pieces.map((p, i) => (
        <div
          key={i}
          className="confetti-piece absolute top-0"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: '2px',
            animationDuration: p.dur,
            animationDelay: p.delay,
            opacity: 0,
          }}
        />
      ))}
    </div>
  )
}

export default function AchievementUnlock({ achievement, onDismiss }) {
  const [visible, setVisible] = useState(false)
  const dismissTimer = useRef(null)

  useEffect(() => {
    // Slight delay so animation triggers after mount
    requestAnimationFrame(() => setVisible(true))
    dismissTimer.current = setTimeout(handleDismiss, 4000)
    return () => clearTimeout(dismissTimer.current)
  }, [])

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(() => onDismiss?.(), 300)
  }

  if (!achievement) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
      onClick={handleDismiss}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      />

      <Confetti />

      {/* Achievement card */}
      <div
        className="relative bg-gradient-to-b from-yellow-50 to-white rounded-3xl shadow-2xl p-8 w-full max-w-sm text-center border border-yellow-200"
        style={{
          opacity:    visible ? 1 : 0,
          transform:  visible ? 'scale(1)' : 'scale(0.6)',
          transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{ boxShadow: visible ? '0 0 40px 8px rgba(239,159,39,0.35)' : 'none', transition: 'box-shadow 0.5s ease 0.3s' }}
        />

        <p className="text-sm font-bold text-brand-amber uppercase tracking-widest mb-3">Achievement Unlocked!</p>

        {/* Badge */}
        <div
          className="achievement-badge-in w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-4xl shadow-xl"
          style={{ boxShadow: '0 0 24px 4px rgba(239,159,39,0.5)' }}
        >
          {achievement.icon || '🏆'}
        </div>

        <h2 className="text-xl font-extrabold text-gray-900 mb-1">{achievement.name}</h2>
        {achievement.description && (
          <p className="text-sm text-gray-500 leading-relaxed">{achievement.description}</p>
        )}

        {achievement.coins > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-2">
            <span className="text-xl">🪙</span>
            <span className="text-base font-bold text-amber-700">+{achievement.coins} Coins</span>
          </div>
        )}

        <button
          onClick={handleDismiss}
          className="mt-6 w-full bg-gradient-to-r from-yellow-400 to-amber-500 text-white font-bold py-3 rounded-xl hover:opacity-90 transition text-sm"
        >
          Awesome!
        </button>

        <p className="text-[10px] text-gray-400 mt-2">Tap anywhere to dismiss</p>
      </div>
    </div>,
    document.body
  )
}
