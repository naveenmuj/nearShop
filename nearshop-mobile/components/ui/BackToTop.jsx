import { useEffect, useRef } from 'react'
import { Animated, TouchableOpacity, StyleSheet, Text } from 'react-native'
import * as Haptics from 'expo-haptics'
import { COLORS, SHADOWS } from '../../constants/theme'

export default function BackToTop({ scrollRef, visible, isFlatList = true }) {
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start()
  }, [visible])

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    if (isFlatList) {
      scrollRef?.current?.scrollToOffset({ offset: 0, animated: true })
    } else {
      scrollRef?.current?.scrollTo({ y: 0, animated: true })
    }
  }

  if (!visible && opacity.__getValue() === 0) return null

  return (
    <Animated.View style={[styles.container, { opacity }]} pointerEvents={visible ? 'auto' : 'none'}>
      <TouchableOpacity
        style={styles.button}
        onPress={handlePress}
        activeOpacity={0.85}
        accessibilityLabel="Back to top"
        accessibilityRole="button"
      >
        <Text style={styles.icon}>↑</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    zIndex: 100,
  },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.cardHover,
  },
  icon: {
    fontSize: 20,
    color: COLORS.white,
    fontWeight: '700',
    lineHeight: 24,
    marginTop: -1,
  },
})
