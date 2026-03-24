import { useEffect, useRef, useState } from 'react'
import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'

const TYPE_CONFIG = {
  success: {
    bg: 'bg-white',
    border: 'border-brand-green',
    icon: <CheckCircle className="w-5 h-5 text-brand-green flex-shrink-0" />,
    bar: 'bg-brand-green',
  },
  error: {
    bg: 'bg-white',
    border: 'border-brand-red',
    icon: <XCircle className="w-5 h-5 text-brand-red flex-shrink-0" />,
    bar: 'bg-brand-red',
  },
  warning: {
    bg: 'bg-white',
    border: 'border-brand-amber',
    icon: <AlertTriangle className="w-5 h-5 text-brand-amber flex-shrink-0" />,
    bar: 'bg-brand-amber',
  },
  info: {
    bg: 'bg-white',
    border: 'border-blue-400',
    icon: <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />,
    bar: 'bg-blue-400',
  },
  coins: {
    bg: 'bg-gradient-to-r from-yellow-400 to-amber-500',
    border: 'border-yellow-300',
    icon: <span className="text-xl flex-shrink-0">🪙</span>,
    bar: 'bg-yellow-200',
    textColor: 'text-white',
  },
  achievement: {
    bg: 'bg-gradient-to-r from-brand-purple to-purple-600',
    border: 'border-purple-400',
    icon: <span className="text-xl flex-shrink-0">🏆</span>,
    bar: 'bg-purple-200',
    textColor: 'text-white',
  },
}

export default function Toast({ toast, onDismiss }) {
  const { id, message, type = 'info', duration = 4000, title } = toast
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info
  const [leaving, setLeaving] = useState(false)
  const dismissTimeout = useRef(null)

  const handleDismiss = () => {
    setLeaving(true)
    dismissTimeout.current = setTimeout(() => onDismiss(id), 250)
  }

  useEffect(() => {
    return () => clearTimeout(dismissTimeout.current)
  }, [])

  const textColor = config.textColor || 'text-gray-900'
  const subColor  = config.textColor ? 'text-white/80' : 'text-gray-500'

  return (
    <div
      className={`
        pointer-events-auto w-full rounded-xl border shadow-lg overflow-hidden
        ${config.bg} ${config.border}
        ${leaving ? 'toast-slide-out' : 'toast-slide-in'}
      `}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {config.icon}
        <div className="flex-1 min-w-0">
          {title && (
            <p className={`text-sm font-bold leading-tight ${textColor}`}>{title}</p>
          )}
          <p className={`text-sm leading-snug ${title ? subColor : textColor}`}>{message}</p>
        </div>
        <button
          onClick={handleDismiss}
          className={`flex-shrink-0 p-0.5 rounded transition opacity-60 hover:opacity-100 ${config.textColor ? 'text-white' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-black/10">
        <div
          className={`h-full ${config.bar} toast-progress-bar`}
          style={{ animationDuration: `${duration}ms` }}
        />
      </div>
    </div>
  )
}
