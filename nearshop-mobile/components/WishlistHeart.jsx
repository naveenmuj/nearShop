import { useRef, useEffect } from 'react'
import { Animated, TouchableOpacity, View, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { COLORS, SHADOWS } from '../constants/theme'

const NUM_PARTICLES = 6
const PARTICLE_COLORS = [COLORS.red, '#FF6B6B', '#FFB3B3', COLORS.pink, '#FF4444', '#FF8888']

function Particle({ anim, angle }) {
  const distance = 28
  const dx = Math.cos(angle) * distance
  const dy = Math.sin(angle) * distance

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, dx],
  })
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, dy],
  })
  const particleOpacity = anim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 1, 0],
  })

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          backgroundColor: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
          opacity: particleOpacity,
          transform: [{ translateX }, { translateY }],
        },
      ]}
    />
  )
}

export default function WishlistHeart({
  isWishlisted,
  onToggle,
  size = 32,
  style,
}) {
  const scale = useRef(new Animated.Value(1)).current
  const particleAnim = useRef(new Animated.Value(0)).current
  const prevWishlisted = useRef(isWishlisted)

  useEffect(() => {
    const wasWishlisted = prevWishlisted.current
    prevWishlisted.current = isWishlisted

    if (isWishlisted && !wasWishlisted) {
      // Add animation: scale up then back, burst particles
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      particleAnim.setValue(0)
      Animated.parallel([
        Animated.sequence([
          Animated.spring(scale, {
            toValue: 1.4,
            tension: 120,
            friction: 5,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            tension: 120,
            friction: 8,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(particleAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start()
    } else if (!isWishlisted && wasWishlisted) {
      // Remove animation: scale down slightly
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 0.8,
          tension: 120,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 120,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [isWishlisted])

  const particles = Array.from({ length: NUM_PARTICLES }, (_, i) => ({
    angle: (i / NUM_PARTICLES) * Math.PI * 2,
  }))

  return (
    <TouchableOpacity
      style={[styles.container, { width: size, height: size, borderRadius: size / 2 }, style]}
      onPress={onToggle}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      activeOpacity={0.85}
      accessibilityLabel={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      accessibilityRole="button"
    >
      {/* Particles layer */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {particles.map((p, i) => (
          <Particle key={i} anim={particleAnim} angle={p.angle} />
        ))}
      </View>

      {/* Heart icon */}
      <Animated.Text
        style={[
          styles.heart,
          { fontSize: size * 0.52, transform: [{ scale }] },
        ]}
      >
        {isWishlisted ? '❤️' : '🤍'}
      </Animated.Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.card,
  },
  heart: {
    lineHeight: undefined,
  },
  particle: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    top: '50%',
    left: '50%',
    marginTop: -3,
    marginLeft: -3,
  },
})
