import { useEffect, useRef } from 'react'
import { Animated, Text, View, StyleSheet, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { COLORS } from '../../../constants/theme'

const TYPE_CONFIG = {
  success: {
    bg: COLORS.green,
    icon: '✅',
    haptic: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  },
  error: {
    bg: COLORS.red,
    icon: '❌',
    haptic: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  },
  warning: {
    bg: COLORS.amber,
    icon: '⚠️',
    haptic: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  },
  info: {
    bg: COLORS.blue,
    icon: 'ℹ️',
    haptic: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  },
  coins: {
    bg: '#F5A623',
    icon: '🪙',
    haptic: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  },
}

export default function Toast({ toast, onDismiss }) {
  const translateY = useRef(new Animated.Value(-100)).current
  const opacity = useRef(new Animated.Value(0)).current

  const config = TYPE_CONFIG[toast.type] || TYPE_CONFIG.info

  useEffect(() => {
    // Trigger haptic
    config.haptic().catch(() => {})

    // Slide in
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start()

    // Auto dismiss
    const timer = setTimeout(() => {
      dismiss()
    }, toast.duration || 4000)

    return () => clearTimeout(timer)
  }, [])

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => onDismiss(toast.id))
  }

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: config.bg, transform: [{ translateY }], opacity },
      ]}
    >
      <Pressable style={styles.inner} onPress={dismiss}>
        <Text style={styles.icon}>{config.icon}</Text>
        <View style={styles.textWrap}>
          <Text style={styles.message}>{toast.message}</Text>
          {toast.type === 'coins' && toast.coins ? (
            <Text style={styles.coinsText}>+{toast.coins} coins!</Text>
          ) : null}
        </View>
        <Text style={styles.closeBtn}>✕</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  toast: {
    borderRadius: 14,
    marginHorizontal: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  icon: {
    fontSize: 20,
  },
  textWrap: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 19,
  },
  coinsText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 2,
  },
  closeBtn: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
})
