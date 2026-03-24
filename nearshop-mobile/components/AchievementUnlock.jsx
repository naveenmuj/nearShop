import { useEffect, useRef } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { COLORS, SHADOWS } from '../constants/theme'

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')
const NUM_CONFETTI = 20
const CONFETTI_COLORS = [
  COLORS.primary, COLORS.green, COLORS.amber, COLORS.red, COLORS.blue,
  '#FF6B6B', '#FFD700', '#7B68EE', '#00CED1', '#FF69B4',
]

function Confetto({ delay }) {
  const startX = useRef(Math.random() * SCREEN_W).current
  const startY = useRef(-20).current
  const endY = useRef(SCREEN_H + 40).current
  const endX = useRef(startX + (Math.random() - 0.5) * 200).current
  const color = useRef(CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]).current
  const size = useRef(6 + Math.random() * 8).current
  const rotation = useRef(Math.random() * 360).current

  const y = useRef(new Animated.Value(startY)).current
  const x = useRef(new Animated.Value(startX)).current
  const opacity = useRef(new Animated.Value(0)).current
  const rotate = useRef(new Animated.Value(rotation)).current

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(y, {
          toValue: endY,
          duration: 2500 + Math.random() * 1500,
          useNativeDriver: true,
        }),
        Animated.timing(x, {
          toValue: endX,
          duration: 2500 + Math.random() * 1500,
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: rotation + 720,
          duration: 2500 + Math.random() * 1500,
          useNativeDriver: true,
        }),
      ]),
    ]).start()
  }, [])

  const rotateInterp = rotate.interpolate({
    inputRange: [rotation, rotation + 720],
    outputRange: [`${rotation}deg`, `${rotation + 720}deg`],
  })

  return (
    <Animated.View
      style={[
        styles.confetto,
        {
          width: size,
          height: size,
          borderRadius: size / 4,
          backgroundColor: color,
          opacity,
          transform: [
            { translateX: x },
            { translateY: y },
            { rotate: rotateInterp },
          ],
        },
      ]}
    />
  )
}

export default function AchievementUnlock({ visible, achievement, onDismiss }) {
  const scale = useRef(new Animated.Value(0.5)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      scale.setValue(0.5)
      opacity.setValue(0)
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start()

      const timer = setTimeout(() => {
        onDismiss?.()
      }, 4000)
      return () => clearTimeout(timer)
    }
  }, [visible])

  if (!visible || !achievement) return null

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={styles.backdrop}>
        {/* Confetti */}
        {Array.from({ length: NUM_CONFETTI }, (_, i) => (
          <Confetto key={i} delay={i * 80} />
        ))}

        {/* Card */}
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale }], opacity },
          ]}
        >
          <Text style={styles.headerText}>Achievement Unlocked!</Text>
          <Text style={styles.achievementIcon}>{achievement.icon || '🏆'}</Text>
          <Text style={styles.achievementName}>{achievement.name}</Text>
          {achievement.description ? (
            <Text style={styles.achievementDesc}>{achievement.description}</Text>
          ) : null}
          {achievement.coins ? (
            <View style={styles.coinsRow}>
              <Text style={styles.coinsText}>+{achievement.coins} coins</Text>
              <Text style={styles.coinsIcon}>🪙</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={onDismiss}
            activeOpacity={0.8}
          >
            <Text style={styles.dismissText}>Awesome!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confetto: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 28,
    marginHorizontal: 32,
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: COLORS.amber,
    shadowColor: COLORS.amber,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
    zIndex: 10,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.amber,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  achievementIcon: {
    fontSize: 64,
    marginBottom: 12,
  },
  achievementName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.gray900,
    textAlign: 'center',
    marginBottom: 8,
  },
  achievementDesc: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  coinsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.amber + '44',
  },
  coinsText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.amber,
  },
  coinsIcon: {
    fontSize: 18,
  },
  dismissBtn: {
    backgroundColor: COLORS.amber,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  dismissText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 16,
  },
})
