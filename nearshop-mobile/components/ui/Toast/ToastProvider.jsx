import { createContext, useState, useCallback, useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Toast from './Toast'
import { setToastRef } from './toastRef'

export const ToastContext = createContext({
  showToast: () => {},
})

let _toastId = 0

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const insets = useSafeAreaInsets()

  const showToast = useCallback(({ type = 'info', message, duration, coins }) => {
    const id = ++_toastId
    setToasts((prev) => {
      // Max 3 toasts at once — remove oldest if needed
      const next = [...prev, { id, type, message, duration, coins }]
      if (next.length > 3) {
        return next.slice(next.length - 3)
      }
      return next
    })
  }, [])

  // Register global ref so toast can be called from anywhere
  useEffect(() => {
    setToastRef(showToast)
    return () => setToastRef(null)
  }, [showToast])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View
        style={[
          styles.container,
          { top: insets.top + 8 },
        ]}
        pointerEvents="box-none"
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onDismiss={dismissToast}
          />
        ))}
      </View>
    </ToastContext.Provider>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
})
