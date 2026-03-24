import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Info, Trash2, X } from 'lucide-react'

export const ConfirmDialogContext = createContext(null)

const VARIANT_CONFIG = {
  danger: {
    icon: <Trash2 className="w-6 h-6 text-brand-red" />,
    iconBg: 'bg-brand-red/10',
    confirmClass: 'bg-brand-red hover:bg-brand-red/90 text-white',
  },
  warning: {
    icon: <AlertTriangle className="w-6 h-6 text-brand-amber" />,
    iconBg: 'bg-brand-amber/10',
    confirmClass: 'bg-brand-amber hover:bg-brand-amber/90 text-white',
  },
  info: {
    icon: <Info className="w-6 h-6 text-brand-purple" />,
    iconBg: 'bg-brand-purple/10',
    confirmClass: 'bg-brand-purple hover:bg-brand-purple/90 text-white',
  },
}

export default function ConfirmDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const [closing, setClosing] = useState(false)
  const resolveRef = useRef(null)

  const confirm = useCallback(({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'info' }) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setDialog({ title, message, confirmText, cancelText, variant })
      setClosing(false)
    })
  }, [])

  const handleResolve = (result) => {
    setClosing(true)
    setTimeout(() => {
      setDialog(null)
      setClosing(false)
      resolveRef.current?.(result)
    }, 150)
  }

  // Escape key cancels
  useEffect(() => {
    if (!dialog) return
    const handler = (e) => { if (e.key === 'Escape') handleResolve(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dialog])

  const config = VARIANT_CONFIG[dialog?.variant] || VARIANT_CONFIG.info

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}

      {dialog && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => handleResolve(false)}
          />
          {/* Dialog box */}
          <div
            className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6
              ${closing ? 'dialog-scale-out' : 'dialog-scale-in'}`}
          >
            <button
              onClick={() => handleResolve(false)}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className={`w-14 h-14 rounded-full ${config.iconBg} flex items-center justify-center mb-4`}>
                {config.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{dialog.title}</h3>
              {dialog.message && (
                <p className="text-sm text-gray-500 leading-relaxed">{dialog.message}</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => handleResolve(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                {dialog.cancelText}
              </button>
              <button
                onClick={() => handleResolve(true)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${config.confirmClass}`}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  )
}
