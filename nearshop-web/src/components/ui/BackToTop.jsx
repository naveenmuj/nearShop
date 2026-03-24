import { useState, useEffect, useCallback } from 'react'
import { ChevronUp } from 'lucide-react'

const SCROLL_THRESHOLD = 400
let throttleTimer = null

export default function BackToTop() {
  const [visible, setVisible] = useState(false)

  const handleScroll = useCallback(() => {
    if (throttleTimer) return
    throttleTimer = setTimeout(() => {
      setVisible(window.scrollY > SCROLL_THRESHOLD)
      throttleTimer = null
    }, 100)
  }, [])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (throttleTimer) clearTimeout(throttleTimer)
    }
  }, [handleScroll])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      className={`fixed z-[998] bg-brand-purple text-white rounded-full shadow-lg p-3 transition-all duration-300 hover:bg-brand-purple/90 hover:shadow-xl
        ${visible ? 'back-to-top-visible' : 'back-to-top-hidden'}
      `}
      style={{ bottom: '80px', right: '24px' }}
    >
      <ChevronUp className="w-5 h-5" />
    </button>
  )
}
