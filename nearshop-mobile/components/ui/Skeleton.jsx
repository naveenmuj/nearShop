import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'

let LinearGradient
try {
  LinearGradient = require('expo-linear-gradient').LinearGradient
} catch {
  function LinearGradientFallback({ style }) {
    return <View style={[style, { backgroundColor: 'rgba(255,255,255,0.35)' }]} />
  }
  LinearGradientFallback.displayName = 'LinearGradientFallback'
  LinearGradient = LinearGradientFallback
}

export default function Skeleton({
  width = '100%',
  height = 20,
  borderRadius = 6,
  style,
  baseColor = '#E8ECF3',
}) {
  const shimmer = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    )
    animation.start()
    return () => animation.stop()
  }, [shimmer])

  return (
    <View style={[styles.container, { width, height, borderRadius, backgroundColor: baseColor }, style]}>
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [
              {
                translateX: shimmer.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-220, 220],
                }),
              },
            ],
          },
        ]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0.65)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradient}
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -120,
    width: 220,
  },
  gradient: {
    flex: 1,
  },
})
