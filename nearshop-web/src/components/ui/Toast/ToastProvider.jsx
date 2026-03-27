import { createContext, useCallback, useRef, useState } from 'react'
import Toast from './Toast'

export const ToastContext = createContext(null)

const MAX_TOASTS = 4
let nextId = 1

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const dismiss = useCallback((id) => {
    clearTimeout(timersRef.current[id])
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback(({ message, type = 'info', duration = 4000, title, action }) => {
    const id = nextId++
    setToasts(prev => {
      const next = [{ id, message, type, duration, title, action }, ...prev]
      return next.slice(0, MAX_TOASTS)
    })
    timersRef.current[id] = setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  // Shorthand methods for common types
  const success = useCallback((message, title) => showToast({ type: 'success', message, title }), [showToast])
  const error = useCallback((message, title) => showToast({ type: 'error', message, title, duration: 5000 }), [showToast])
  const warning = useCallback((message, title) => showToast({ type: 'warning', message, title }), [showToast])
  const info = useCallback((message, title) => showToast({ type: 'info', message, title }), [showToast])

  const showCoinToast = useCallback((coins, message) => {
    return showToast({
      type: 'coins',
      title: `+${coins} Coins`,
      message: message || 'You earned coins!',
      duration: 5000,
    })
  }, [showToast])

  const showAchievementToast = useCallback((achievement) => {
    return showToast({
      type: 'achievement',
      title: 'Achievement Unlocked! 🎉',
      message: achievement.name || achievement,
      duration: 5000,
    })
  }, [showToast])

  const showOrderToast = useCallback((message, title = 'Order Update') => {
    return showToast({
      type: 'order',
      title,
      message,
      duration: 5000,
    })
  }, [showToast])

  const showDealToast = useCallback((message, title = 'Deal Alert! 🔥') => {
    return showToast({
      type: 'deal',
      title,
      message,
      duration: 5000,
    })
  }, [showToast])

  const showPaymentToast = useCallback((message, title = 'Payment Successful') => {
    return showToast({
      type: 'payment',
      title,
      message,
      duration: 4000,
    })
  }, [showToast])

  const showPremiumToast = useCallback((message, title) => {
    return showToast({
      type: 'premium',
      title: title || '✨ Premium Feature',
      message,
      duration: 5000,
    })
  }, [showToast])

  return (
    <ToastContext.Provider value={{ 
      showToast, 
      success, 
      error, 
      warning, 
      info,
      showCoinToast, 
      showAchievementToast,
      showOrderToast,
      showDealToast,
      showPaymentToast,
      showPremiumToast,
      dismiss 
    }}>
      {children}
      {/* Toast container — top-right */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none"
        style={{ maxWidth: '400px', width: 'calc(100vw - 2rem)' }}
      >
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
