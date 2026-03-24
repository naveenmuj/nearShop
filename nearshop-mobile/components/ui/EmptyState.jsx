import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { COLORS, SHADOWS } from '../../constants/theme'

const CONFIGS = {
  cart: {
    icon: '🛒',
    title: 'Your cart is empty',
    subtitle: 'Add items to get started',
    cta: 'Browse Products',
    ctaPath: '/(customer)/search',
  },
  wishlist: {
    icon: '💝',
    title: 'No wishlist items',
    subtitle: 'Save products you love',
    cta: 'Explore',
    ctaPath: '/(customer)/home',
  },
  orders: {
    icon: '📦',
    title: 'No orders yet',
    subtitle: 'Your order history will appear here',
    cta: 'Start Shopping',
    ctaPath: '/(customer)/home',
  },
  search: {
    icon: '🔍',
    title: 'No results found',
    subtitle: 'Try a different search term',
    cta: null,
    ctaPath: null,
  },
  notifications: {
    icon: '🔔',
    title: 'All caught up!',
    subtitle: 'No new notifications',
    cta: null,
    ctaPath: null,
  },
  default: {
    icon: '✨',
    title: 'Nothing here yet',
    subtitle: '',
    cta: null,
    ctaPath: null,
  },
}

export default function EmptyState({ type = 'default', onCTA, ctaLabel }) {
  const router = useRouter()
  const fadeAnim = useRef(new Animated.Value(0)).current

  const config = CONFIGS[type] || CONFIGS.default
  const ctaText = ctaLabel || config.cta

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start()
  }, [])

  const handleCTA = () => {
    if (onCTA) {
      onCTA()
    } else if (config.ctaPath) {
      router.push(config.ctaPath)
    }
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Text style={styles.icon}>{config.icon}</Text>
      <Text style={styles.title}>{config.title}</Text>
      {!!config.subtitle && (
        <Text style={styles.subtitle}>{config.subtitle}</Text>
      )}
      {!!ctaText && (
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={handleCTA}
          activeOpacity={0.8}
        >
          <Text style={styles.ctaText}>{ctaText}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
    paddingBottom: 60,
  },
  icon: {
    fontSize: 64,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.gray800,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
  },
  ctaBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  ctaText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },
})
