import { useEffect, useRef, useState } from 'react'
import { X, CheckCircle, XCircle, AlertTriangle, Info, Sparkles, ShoppingBag, Gift, Truck, CreditCard } from 'lucide-react'

// Animated icon wrappers
const AnimatedSuccessIcon = () => (
  <div className="relative">
    <div className="toast-icon-pop">
      <CheckCircle className="w-6 h-6 text-brand-green flex-shrink-0" />
    </div>
    <div className="absolute inset-0 toast-icon-ring bg-brand-green/20 rounded-full" />
  </div>
)

const AnimatedErrorIcon = () => (
  <div className="toast-icon-shake">
    <XCircle className="w-6 h-6 text-brand-red flex-shrink-0" />
  </div>
)

const AnimatedWarningIcon = () => (
  <div className="toast-icon-pulse">
    <AlertTriangle className="w-6 h-6 text-brand-amber flex-shrink-0" />
  </div>
)

const AnimatedInfoIcon = () => (
  <div className="toast-icon-pop">
    <Info className="w-6 h-6 text-blue-500 flex-shrink-0" />
  </div>
)

const TYPE_CONFIG = {
  success: {
    bg: 'bg-gradient-to-r from-white to-green-50',
    border: 'border-brand-green/30',
    shadow: 'shadow-green-100',
    icon: <AnimatedSuccessIcon />,
    bar: 'bg-gradient-to-r from-brand-green to-emerald-400',
    glow: 'before:bg-gradient-to-r before:from-brand-green/20 before:to-transparent',
  },
  error: {
    bg: 'bg-gradient-to-r from-white to-red-50',
    border: 'border-brand-red/30',
    shadow: 'shadow-red-100',
    icon: <AnimatedErrorIcon />,
    bar: 'bg-gradient-to-r from-brand-red to-rose-400',
    glow: 'before:bg-gradient-to-r before:from-brand-red/20 before:to-transparent',
  },
  warning: {
    bg: 'bg-gradient-to-r from-white to-amber-50',
    border: 'border-brand-amber/30',
    shadow: 'shadow-amber-100',
    icon: <AnimatedWarningIcon />,
    bar: 'bg-gradient-to-r from-brand-amber to-yellow-400',
    glow: 'before:bg-gradient-to-r before:from-brand-amber/20 before:to-transparent',
  },
  info: {
    bg: 'bg-gradient-to-r from-white to-blue-50',
    border: 'border-blue-300/30',
    shadow: 'shadow-blue-100',
    icon: <AnimatedInfoIcon />,
    bar: 'bg-gradient-to-r from-blue-400 to-cyan-400',
    glow: 'before:bg-gradient-to-r before:from-blue-400/20 before:to-transparent',
  },
  coins: {
    bg: 'bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500',
    border: 'border-yellow-300/50',
    shadow: 'shadow-yellow-200',
    icon: <span className="text-2xl flex-shrink-0 toast-icon-bounce">🪙</span>,
    bar: 'bg-gradient-to-r from-yellow-200 to-white/50',
    textColor: 'text-white',
    subColor: 'text-white/90',
  },
  achievement: {
    bg: 'bg-gradient-to-br from-brand-purple via-purple-600 to-indigo-600',
    border: 'border-purple-400/50',
    shadow: 'shadow-purple-200',
    icon: <span className="text-2xl flex-shrink-0 toast-icon-bounce">🏆</span>,
    bar: 'bg-gradient-to-r from-purple-200 to-white/50',
    textColor: 'text-white',
    subColor: 'text-white/90',
  },
  order: {
    bg: 'bg-gradient-to-br from-brand-blue via-blue-500 to-cyan-500',
    border: 'border-blue-300/50',
    shadow: 'shadow-blue-200',
    icon: <ShoppingBag className="w-6 h-6 text-white flex-shrink-0 toast-icon-pop" />,
    bar: 'bg-gradient-to-r from-blue-200 to-white/50',
    textColor: 'text-white',
    subColor: 'text-white/90',
  },
  delivery: {
    bg: 'bg-gradient-to-br from-teal-500 via-emerald-500 to-green-500',
    border: 'border-emerald-300/50',
    shadow: 'shadow-emerald-200',
    icon: <Truck className="w-6 h-6 text-white flex-shrink-0 toast-icon-slide" />,
    bar: 'bg-gradient-to-r from-emerald-200 to-white/50',
    textColor: 'text-white',
    subColor: 'text-white/90',
  },
  payment: {
    bg: 'bg-gradient-to-br from-green-500 via-emerald-500 to-teal-500',
    border: 'border-green-300/50',
    shadow: 'shadow-green-200',
    icon: <CreditCard className="w-6 h-6 text-white flex-shrink-0 toast-icon-pop" />,
    bar: 'bg-gradient-to-r from-green-200 to-white/50',
    textColor: 'text-white',
    subColor: 'text-white/90',
  },
  deal: {
    bg: 'bg-gradient-to-br from-pink-500 via-rose-500 to-red-500',
    border: 'border-pink-300/50',
    shadow: 'shadow-pink-200',
    icon: <Gift className="w-6 h-6 text-white flex-shrink-0 toast-icon-bounce" />,
    bar: 'bg-gradient-to-r from-pink-200 to-white/50',
    textColor: 'text-white',
    subColor: 'text-white/90',
  },
  premium: {
    bg: 'bg-gradient-to-br from-slate-800 via-slate-900 to-black',
    border: 'border-yellow-500/50',
    shadow: 'shadow-slate-400',
    icon: <Sparkles className="w-6 h-6 text-yellow-400 flex-shrink-0 toast-icon-sparkle" />,
    bar: 'bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-400',
    textColor: 'text-white',
    subColor: 'text-gray-300',
  },
}

export default function Toast({ toast, onDismiss }) {
  const { id, message, type = 'info', duration = 4000, title, action } = toast
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info
  const [leaving, setLeaving] = useState(false)
  const dismissTimeout = useRef(null)

  const handleDismiss = () => {
    setLeaving(true)
    dismissTimeout.current = setTimeout(() => onDismiss(id), 300)
  }

  useEffect(() => {
    return () => clearTimeout(dismissTimeout.current)
  }, [])

  const textColor = config.textColor || 'text-gray-900'
  const subColor = config.subColor || (config.textColor ? 'text-white/80' : 'text-gray-600')

  return (
    <div
      className={`
        pointer-events-auto w-full rounded-2xl border-2 overflow-hidden backdrop-blur-sm
        relative before:absolute before:inset-0 before:opacity-50 ${config.glow || ''}
        ${config.bg} ${config.border} ${config.shadow}
        ${leaving ? 'toast-slide-out' : 'toast-slide-in'}
        hover:scale-[1.02] transition-transform duration-200
      `}
      style={{ 
        boxShadow: '0 8px 32px -4px rgba(0,0,0,0.15), 0 4px 8px -2px rgba(0,0,0,0.1)' 
      }}
    >
      <div className="flex items-start gap-3 px-4 py-4 relative z-10">
        <div className="flex-shrink-0 mt-0.5">
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <p className={`text-sm font-bold leading-tight mb-0.5 ${textColor}`}>{title}</p>
          )}
          <p className={`text-sm leading-snug ${title ? subColor : textColor}`}>{message}</p>
          {action && (
            <button 
              onClick={action.onClick}
              className={`mt-2 text-xs font-semibold underline underline-offset-2 ${textColor} hover:opacity-80 transition-opacity`}
            >
              {action.label}
            </button>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className={`flex-shrink-0 p-1.5 rounded-full transition-all hover:bg-black/10 ${config.textColor ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Animated progress bar */}
      <div className="h-1 bg-black/10 relative overflow-hidden">
        <div
          className={`h-full ${config.bar} toast-progress-bar relative`}
          style={{ animationDuration: `${duration}ms` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent toast-shimmer" />
        </div>
      </div>
    </div>
  )
}
