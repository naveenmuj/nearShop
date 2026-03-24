import { createContext, useState, useRef, useCallback, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Pressable,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { COLORS, SHADOWS } from '../../../constants/theme'

export const ConfirmDialogContext = createContext({
  confirm: async () => false,
})

const VARIANT_COLORS = {
  danger: COLORS.red,
  warning: COLORS.amber,
  default: COLORS.primary,
}

export default function ConfirmDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null)
  const resolveRef = useRef(null)
  const scale = useRef(new Animated.Value(0.9)).current
  const opacity = useRef(new Animated.Value(0)).current

  const confirm = useCallback(
    ({
      title = 'Are you sure?',
      message = '',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      variant = 'default',
    } = {}) => {
      return new Promise((resolve) => {
        resolveRef.current = resolve
        setDialog({ title, message, confirmText, cancelText, variant })
      })
    },
    []
  )

  useEffect(() => {
    if (dialog) {
      scale.setValue(0.9)
      opacity.setValue(0)
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 80,
          friction: 9,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [dialog])

  const handleConfirm = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
    const resolve = resolveRef.current
    setDialog(null)
    resolveRef.current = null
    resolve?.(true)
  }

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    const resolve = resolveRef.current
    setDialog(null)
    resolveRef.current = null
    resolve?.(false)
  }

  const confirmColor = dialog ? (VARIANT_COLORS[dialog.variant] || COLORS.primary) : COLORS.primary

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <Modal
        visible={!!dialog}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleCancel}
      >
        <Pressable style={styles.backdrop} onPress={handleCancel}>
          <Animated.View
            style={[
              styles.card,
              { transform: [{ scale }], opacity },
            ]}
          >
            <Pressable onPress={() => {}}>
              <Text style={styles.title}>{dialog?.title}</Text>
              {!!dialog?.message && (
                <Text style={styles.message}>{dialog.message}</Text>
              )}
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.cancelBtn]}
                  onPress={handleCancel}
                  activeOpacity={0.75}
                >
                  <Text style={styles.cancelText}>{dialog?.cancelText || 'Cancel'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.confirmBtn, { backgroundColor: confirmColor }]}
                  onPress={handleConfirm}
                  activeOpacity={0.75}
                >
                  <Text style={styles.confirmText}>{dialog?.confirmText || 'Confirm'}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>
    </ConfirmDialogContext.Provider>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    ...SHADOWS.cardHover,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray900,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: COLORS.gray600,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: COLORS.gray100,
  },
  confirmBtn: {
    backgroundColor: COLORS.primary,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray700,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
})
