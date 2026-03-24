import { useEffect, useRef, useState } from 'react'

const DIRECTION_TRANSFORM = {
  up:    'translateY(24px)',
  down:  'translateY(-24px)',
  left:  'translateX(24px)',
  right: 'translateX(-24px)',
}

export default function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  once = true,
  className = '',
}) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  // Respect prefers-reduced-motion
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (prefersReduced) { setVisible(true); return }

    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          if (once) observer.unobserve(el)
        } else if (!once) {
          setVisible(false)
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [once, prefersReduced])

  const initTransform = DIRECTION_TRANSFORM[direction] || DIRECTION_TRANSFORM.up

  return (
    <div
      ref={ref}
      className={`${className}`}
      style={{
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'none' : initTransform,
        transition: `opacity 0.5s ease-out ${delay}ms, transform 0.5s ease-out ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  )
}
