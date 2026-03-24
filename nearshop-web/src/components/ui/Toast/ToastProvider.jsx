import { createContext, useCallback, useRef, useState } from 'react'
import Toast from './Toast'

export const ToastContext = createContext(null)

const MAX_TOASTS = 3
let nextId = 1

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef({})

  const dismiss = useCallback((id) => {
    clearTimeout(timersRef.current[id])
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback(({ message, type = 'info', duration = 4000, title }) => {
    const id = nextId++
    setToasts(prev => {
      const next = [{ id, message, type, duration, title }, ...prev]
      return next.slice(0, MAX_TOASTS)
    })
    timersRef.current[id] = setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

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
      title: 'Achievement Unlocked!',
      message: achievement.name || achievement,
      duration: 5000,
    })
  }, [showToast])

  return (
    <ToastContext.Provider value={{ showToast, showCoinToast, showAchievementToast }}>
      {children}
      {/* Toast container — top-right */}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none"
        style={{ maxWidth: '360px', width: 'calc(100vw - 2rem)' }}
      >
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
