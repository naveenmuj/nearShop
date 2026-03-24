import { useEffect, useRef } from 'react'
import { Animated, StyleSheet } from 'react-native'

export default function Skeleton({ width = '100%', height = 20, borderRadius = 6, style }) {
  const opacity = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 750, useNativeDriver: true }),
      ])
    )
    animation.start()
    return () => opacity.stopAnimation()
  }, [])

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: '#E5E7EB', opacity }, style]}
    />
  )
}
