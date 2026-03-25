import { useEffect, useRef } from 'react'
import { Animated, Text, View, StyleSheet, Pressable } from 'react-native'
import * as Haptics from 'expo-haptics'
import { COLORS } from '../../../constants/theme'

const TYPE_CONFIG = {
  success: {
    bg: '#059669',
    bgGradient: '#D1FAE5',
    icon: '✅',
    label: 'Success',
    animation: 'bounce', // bouncy entrance
    haptic: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  },
  error: {
    bg: '#DC2626',
    bgGradient: '#FEE2E2',
    icon: '❌',
    label: 'Error',
    animation: 'shake', // shake to draw attention
    haptic: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  },
  warning: {
    bg: '#D97706',
    bgGradient: '#FEF3C7',
    icon: '⚠️',
    label: 'Warning',
    animation: 'slideRight', // slide from right
    haptic: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  },
  info: {
    bg: '#2563EB',
    bgGradient: '#DBEAFE',
    icon: 'ℹ️',
    label: 'Info',
    animation: 'fade', // gentle fade
    haptic: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  },
  coins: {
    bg: '#F59E0B',
    bgGradient: '#FEF3C7',
    icon: '🪙',
    label: 'Reward',
    animation: 'scale', // scale up pop
    haptic: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  },
  order: {
    bg: '#7C3AED',
    bgGradient: '#EDE9FE',
    icon: '📦',
    label: 'Order',
    animation: 'bounce',
    haptic: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  },
  cart: {
    bg: '#059669',
    bgGradient: '#D1FAE5',
    icon: '🛒',
    label: 'Cart',
    animation: 'scale',
    haptic: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  },
}

export default function Toast({ toast: toastData, onDismiss }) {
  const config = TYPE_CONFIG[toastData.type] || TYPE_CONFIG.info

  // Animation values
  const translateY = useRef(new Animated.Value(-120)).current
  const translateX = useRef(new Animated.Value(config.animation === 'slideRight' ? 400 : 0)).current
  const opacity = useRef(new Animated.Value(0)).current
  const scale = useRef(new Animated.Value(config.animation === 'scale' ? 0.3 : 1)).current
  const shakeX = useRef(new Animated.Value(0)).current
  const progressWidth = useRef(new Animated.Value(100)).current

  const duration = toastData.duration || 4000

  useEffect(() => {
    // Trigger haptic
    config.haptic().catch(() => {})

    const animations = []

    // Entrance animation based on type
    switch (config.animation) {
      case 'bounce':
        animations.push(
          Animated.spring(translateY, {
            toValue: 0, tension: 60, friction: 8, useNativeDriver: true,
          }),
          Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true })
        )
        break

      case 'shake':
        animations.push(
          Animated.parallel([
            Animated.spring(translateY, {
              toValue: 0, tension: 80, friction: 10, useNativeDriver: true,
            }),
            Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ])
        )
        // Add shake after entrance
        setTimeout(() => {
          Animated.sequence([
            Animated.timing(shakeX, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeX, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeX, { toValue: 8, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeX, { toValue: -8, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
          ]).start()
        }, 200)
        break

      case 'slideRight':
        animations.push(
          Animated.parallel([
            Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
            Animated.spring(translateX, {
              toValue: 0, tension: 50, friction: 9, useNativeDriver: true,
            }),
            Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          ])
        )
        break

      case 'scale':
        animations.push(
          Animated.parallel([
            Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
            Animated.spring(scale, {
              toValue: 1, tension: 65, friction: 7, useNativeDriver: true,
            }),
            Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ])
        )
        break

      case 'fade':
      default:
        animations.push(
          Animated.parallel([
            Animated.timing(translateY, { toValue: 0, duration: 300, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
          ])
        )
    }

    Animated.parallel(animations).start()

    // Progress bar countdown
    Animated.timing(progressWidth, {
      toValue: 0,
      duration: duration,
      useNativeDriver: false,
    }).start()

    // Auto dismiss
    const timer = setTimeout(() => dismiss(), duration)
    return () => clearTimeout(timer)
  }, [])

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -80, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss(toastData.id))
  }

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: config.bg,
          transform: [
            { translateY },
            { translateX: Animated.add(translateX, shakeX) },
            { scale },
          ],
          opacity,
        },
      ]}
    >
      <Pressable style={styles.inner} onPress={dismiss}>
        {/* Icon with circle background */}
        <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={styles.icon}>{config.icon}</Text>
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.label}>{config.label}</Text>
          <Text style={styles.message} numberOfLines={2}>{toastData.message}</Text>
          {toastData.type === 'coins' && toastData.coins ? (
            <Text style={styles.coinsText}>+{toastData.coins} coins earned!</Text>
          ) : null}
        </View>

        <Text style={styles.closeBtn}>✕</Text>
      </Pressable>

      {/* Progress bar */}
      <Animated.View
        style={[
          styles.progressBar,
          {
            width: progressWidth.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          },
        ]}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  toast: {
    borderRadius: 16,
    marginHorizontal: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 19,
  },
  coinsText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 3,
  },
  closeBtn: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
    padding: 4,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 2,
  },
})
