import { useState, useRef } from 'react'
import { Heart } from 'lucide-react'
import { addToWishlist, removeFromWishlist } from '../api/wishlists'

// 6 particles at different angles
const PARTICLES = [
  { angle: 0,   color: '#FF6B6B' },
  { angle: 60,  color: '#FF9F43' },
  { angle: 120, color: '#EE5A24' },
  { angle: 180, color: '#FDA7DF' },
  { angle: 240, color: '#FF6B6B' },
  { angle: 300, color: '#C0392B' },
]

export default function WishlistHeart({
  productId,
  initialWishlisted = false,
  onToggle,
  size = 'md',
  className = '',
}) {
  const [wishlisted, setWishlisted] = useState(initialWishlisted)
  const [bursting, setBursting] = useState(false)
  const [animating, setAnimating] = useState(false)
  const containerRef = useRef(null)

  const sizeMap = {
    sm: { btn: 'p-1',   icon: 'w-4 h-4', particle: 20 },
    md: { btn: 'p-2',   icon: 'w-5 h-5', particle: 28 },
    lg: { btn: 'p-2.5', icon: 'w-6 h-6', particle: 36 },
  }
  const s = sizeMap[size] || sizeMap.md

  const handleClick = async (e) => {
    e.stopPropagation()
    if (animating) return
    const next = !wishlisted
    setAnimating(true)

    if (next) {
      setBursting(true)
      setTimeout(() => setBursting(false), 700)
    }

    setWishlisted(next)
    onToggle?.(productId, next)

    try {
      if (next) await addToWishlist(productId)
      else      await removeFromWishlist(productId)
    } catch {
      // revert optimistic update
      setWishlisted(!next)
      onToggle?.(productId, !next)
    }
    setTimeout(() => setAnimating(false), 400)
  }

  return (
    <div ref={containerRef} className={`relative inline-flex items-center justify-center ${className}`}>
      {/* Burst particles */}
      {bursting && PARTICLES.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180
        const tx  = `${Math.round(Math.cos(rad) * s.particle)}px`
        const ty  = `${Math.round(Math.sin(rad) * s.particle)}px`
        return (
          <span
            key={i}
            className="heart-particle absolute w-2 h-2 rounded-full pointer-events-none"
            style={{
              background: p.color,
              '--tx': tx,
              '--ty': ty,
              animationDelay: `${i * 20}ms`,
            }}
          />
        )
      })}

      {/* Heart button */}
      <button
        onClick={handleClick}
        aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        className={`relative ${s.btn} rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors`}
        style={{
          transform: animating ? (wishlisted ? 'scale(1.3)' : 'scale(0.85)') : 'scale(1)',
          transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <Heart
          className={`${s.icon} transition-colors ${wishlisted ? 'fill-brand-red text-brand-red' : 'text-gray-500'}`}
        />
      </button>
    </div>
  )
}
