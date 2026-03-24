import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated } from 'react-native'
import { COLORS } from '../constants/theme'

function formatTimestamp(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleString('en-IN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function PulsingCircle() {
  const scale = useRef(new Animated.Value(1)).current
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.35, duration: 700, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      ])
    ).start()
    return () => {
      scale.stopAnimation()
      opacity.stopAnimation()
    }
  }, [])

  return (
    <View style={styles.circleWrap}>
      <Animated.View
        style={[
          styles.pulseRing,
          { transform: [{ scale }], opacity },
        ]}
      />
      <View style={[styles.circle, styles.circleActive]} />
    </View>
  )
}

function TimelineStep({ step, isLast }) {
  const isCompleted = step.completed === true
  const isCurrent = step.is_current === true

  return (
    <View style={styles.step}>
      {/* Left: circle + connector line */}
      <View style={styles.leftCol}>
        {isCurrent ? (
          <PulsingCircle />
        ) : (
          <View
            style={[
              styles.circle,
              isCompleted ? styles.circleCompleted : styles.circleFuture,
            ]}
          >
            {isCompleted && <Text style={styles.checkmark}>✓</Text>}
          </View>
        )}
        {!isLast && (
          <View
            style={[
              styles.line,
              isCompleted ? styles.lineCompleted : styles.lineFuture,
            ]}
          />
        )}
      </View>

      {/* Right: content */}
      <View style={styles.rightCol}>
        <Text
          style={[
            styles.stepTitle,
            isCompleted || isCurrent ? styles.stepTitleActive : styles.stepTitleFuture,
          ]}
        >
          {step.title}
        </Text>
        {step.description ? (
          <Text style={styles.stepDescription}>{step.description}</Text>
        ) : null}
        {step.timestamp ? (
          <Text style={styles.stepTime}>{formatTimestamp(step.timestamp)}</Text>
        ) : null}
      </View>
    </View>
  )
}

export default function OrderTimeline({ timeline = [] }) {
  if (!timeline || timeline.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No tracking information available</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {timeline.map((step, index) => (
        <TimelineStep
          key={step.status || index}
          step={step}
          isLast={index === timeline.length - 1}
        />
      ))}
    </View>
  )
}

const CIRCLE_SIZE = 24
const LINE_WIDTH = 2

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  step: {
    flexDirection: 'row',
    gap: 16,
  },
  leftCol: {
    alignItems: 'center',
    width: CIRCLE_SIZE,
  },
  circleWrap: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: COLORS.primary + '40',
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleCompleted: {
    backgroundColor: COLORS.primary,
  },
  circleActive: {
    backgroundColor: COLORS.primary,
    zIndex: 1,
  },
  circleFuture: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.gray300,
  },
  checkmark: {
    fontSize: 13,
    color: COLORS.white,
    fontWeight: '700',
  },
  line: {
    width: LINE_WIDTH,
    flex: 1,
    minHeight: 24,
    marginVertical: 2,
  },
  lineCompleted: {
    backgroundColor: COLORS.primary,
  },
  lineFuture: {
    backgroundColor: COLORS.gray200,
    // Dashed effect via borderStyle is limited on RN; use dotted approximation
  },
  rightCol: {
    flex: 1,
    paddingBottom: 24,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  stepTitleActive: {
    color: COLORS.gray900,
  },
  stepTitleFuture: {
    color: COLORS.gray400,
  },
  stepDescription: {
    fontSize: 13,
    color: COLORS.gray600,
    lineHeight: 18,
    marginBottom: 3,
  },
  stepTime: {
    fontSize: 12,
    color: COLORS.gray400,
    fontWeight: '500',
  },
  empty: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.gray500,
  },
})
