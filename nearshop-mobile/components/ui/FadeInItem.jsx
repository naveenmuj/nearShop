import { useEffect, useRef } from 'react'
import { Animated } from 'react-native'

export default function FadeInItem({
  index = 0,
  children,
  style,
  reduceMotion = false,
  duration = 400,
  delayStep = 80,
  distance = 20,
}) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(distance)).current

  useEffect(() => {
    const delay = reduceMotion ? 0 : index * delayStep
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: reduceMotion ? 160 : duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: reduceMotion ? 160 : duration,
        delay,
        useNativeDriver: true,
      }),
    ]).start()
  }, [index, reduceMotion, duration, delayStep, opacity, translateY])

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}
