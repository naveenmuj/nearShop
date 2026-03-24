import { useState, useEffect, useRef } from 'react'
import { Text, View, StyleSheet, Animated } from 'react-native'
import { COLORS } from '../constants/theme'

function getRemainingParts(dealEndsAt) {
  const end = new Date(dealEndsAt).getTime()
  const now = Date.now()
  const diff = end - now

  if (diff <= 0) return null

  const totalSeconds = Math.floor(diff / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return { days, hours, minutes, seconds, totalSeconds }
}

function pad(n) {
  return String(n).padStart(2, '0')
}

export default function DealCountdown({ dealEndsAt, compact = false }) {
  const [parts, setParts] = useState(() => getRemainingParts(dealEndsAt))
  const flickerAnim = useRef(new Animated.Value(1)).current
  const flickerLoop = useRef(null)

  useEffect(() => {
    const tick = () => setParts(getRemainingParts(dealEndsAt))
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [dealEndsAt])

  // When < 1 hour remaining, start a subtle flicker
  const isUrgent = parts && parts.totalSeconds < 3600
  useEffect(() => {
    if (isUrgent) {
      flickerLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(flickerAnim, { toValue: 0.5, duration: 600, useNativeDriver: true }),
          Animated.timing(flickerAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      )
      flickerLoop.current.start()
    } else {
      if (flickerLoop.current) flickerLoop.current.stop()
      flickerAnim.setValue(1)
    }
    return () => {
      if (flickerLoop.current) flickerLoop.current.stop()
    }
  }, [isUrgent])

  if (!parts) {
    if (compact) {
      return <Text style={[styles.compactText, styles.expired]}>Deal Ended</Text>
    }
    return (
      <View style={styles.container}>
        <Text style={styles.expiredText}>Deal Ended</Text>
      </View>
    )
  }

  const urgentColor = isUrgent ? COLORS.red : COLORS.amber
  const timeStr = parts.days > 0
    ? `${parts.days}d ${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`
    : `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`

  if (compact) {
    return (
      <Animated.View style={[styles.compactWrap, { opacity: isUrgent ? flickerAnim : 1, backgroundColor: urgentColor + '22' }]}>
        <Text style={styles.compactIcon}>⏱</Text>
        <Text style={[styles.compactText, { color: urgentColor }]}>{timeStr}</Text>
      </Animated.View>
    )
  }

  return (
    <Animated.View style={[styles.container, { opacity: isUrgent ? flickerAnim : 1, borderColor: urgentColor + '44' }]}>
      <Text style={[styles.label, { color: urgentColor }]}>⏱ Ends in</Text>
      <Text style={[styles.timeText, { color: urgentColor }]}>{timeStr}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.amberLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.amber + '44',
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.amber,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.amber,
    fontVariant: ['tabular-nums'],
  },
  expiredText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.gray400,
  },
  compactWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  compactIcon: {
    fontSize: 10,
  },
  compactText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.amber,
  },
  expired: {
    color: COLORS.gray400,
    fontSize: 10,
    fontWeight: '500',
  },
})
