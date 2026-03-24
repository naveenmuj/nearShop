import { useRef, useState } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet, Dimensions, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../constants/theme';

const { width: W } = Dimensions.get('window');
const WHEEL_SIZE = W * 0.75;
const SEGMENTS = [
  { label: '5 🪙',    coins: 5,   color: COLORS.primaryLight,  textColor: COLORS.primary },
  { label: '10 🪙',   coins: 10,  color: COLORS.greenLight,    textColor: COLORS.green },
  { label: '20 🪙',   coins: 20,  color: COLORS.amberLight,    textColor: COLORS.amber },
  { label: '50 🪙',   coins: 50,  color: '#FFE4E1',            textColor: COLORS.coral },
  { label: '100 🪙',  coins: 100, color: '#E6F1FB',            textColor: COLORS.blue },
  { label: '2× 🚀',   coins: 0,   color: '#FEF3C7',            textColor: '#D97706' },
  { label: '200 🪙',  coins: 200, color: '#F3E8FF',            textColor: '#7C3AED' },
];
const SEG_ANGLE = 360 / SEGMENTS.length;

export default function SpinWheel({ onSpin, disabled }) {
  const rotation = useRef(new Animated.Value(0)).current;
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const currentAngle = useRef(0);

  const spin = async () => {
    if (spinning || disabled) return;
    setSpinning(true);
    setResult(null);

    let segmentIndex = 0;
    let prize = '5 coins';
    try {
      const data = await onSpin();
      segmentIndex = data.segment_index ?? 0;
      prize = data.prize ?? '5 coins';
    } catch {}

    // Rotate to land exactly on segmentIndex
    // pointer is at top → segment 0 starts at top
    // to land segment i: rotate so i*SEG_ANGLE ends up at top (i.e. 360 - i*SEG_ANGLE + extra full rotations)
    const targetAngle = currentAngle.current + (360 * 5) + (360 - segmentIndex * SEG_ANGLE);
    currentAngle.current = targetAngle % 360;

    Animated.timing(rotation, {
      toValue: targetAngle,
      duration: 4000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setSpinning(false);
      setResult(prize);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });
  };

  const rotate = rotation.interpolate({ inputRange: [0, 360], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.container}>
      {/* Pointer arrow at top */}
      <View style={styles.pointer}>
        <Text style={styles.pointerText}>▼</Text>
      </View>

      {/* Wheel */}
      <Animated.View style={[styles.wheel, { transform: [{ rotate }] }]}>
        {SEGMENTS.map((seg, i) => {
          const angle = i * SEG_ANGLE;
          return (
            <View
              key={i}
              style={[styles.segment, {
                backgroundColor: seg.color,
                transform: [{ rotate: `${angle}deg` }],
              }]}
            >
              <View style={styles.segLabel}>
                <Text style={[styles.segText, { color: seg.textColor }]} numberOfLines={1}>
                  {seg.label}
                </Text>
              </View>
            </View>
          );
        })}
        {/* Center circle */}
        <View style={styles.center}>
          <Text style={styles.centerText}>🎯</Text>
        </View>
      </Animated.View>

      {/* Spin button */}
      <TouchableOpacity
        style={[styles.spinBtn, (spinning || disabled) && styles.spinBtnDisabled]}
        onPress={spin}
        disabled={spinning || disabled}
      >
        <Text style={styles.spinBtnText}>{spinning ? 'Spinning...' : 'SPIN'}</Text>
      </TouchableOpacity>

      {/* Result */}
      {result && !spinning && (
        <View style={styles.result}>
          <Text style={styles.resultText}>🎉 {result}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 16 },
  pointer: { marginBottom: -12, zIndex: 10 },
  pointerText: { fontSize: 28, color: COLORS.primary },
  wheel: {
    width: WHEEL_SIZE, height: WHEEL_SIZE, borderRadius: WHEEL_SIZE / 2,
    borderWidth: 4, borderColor: COLORS.primary,
    overflow: 'hidden', position: 'relative', backgroundColor: COLORS.gray100,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 10,
  },
  segment: {
    position: 'absolute', width: '50%', height: '50%',
    bottom: '50%', right: '50%', transformOrigin: 'bottom right',
    justifyContent: 'flex-start', alignItems: 'center',
    paddingTop: 12,
  },
  segLabel: { transform: [{ rotate: `${SEG_ANGLE / 2}deg` }] },
  segText: { fontSize: 10, fontWeight: '700', width: 55, textAlign: 'center' },
  center: {
    position: 'absolute', width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#fff', top: WHEEL_SIZE / 2 - 25, left: WHEEL_SIZE / 2 - 25,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: COLORS.primary, zIndex: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  centerText: { fontSize: 24 },
  spinBtn: {
    marginTop: 24, backgroundColor: COLORS.primary, borderRadius: 50,
    paddingHorizontal: 40, paddingVertical: 16,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  spinBtnDisabled: { opacity: 0.6 },
  spinBtnText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  result: {
    marginTop: 20, padding: 16, backgroundColor: COLORS.amberLight,
    borderRadius: 16, borderWidth: 2, borderColor: COLORS.amber,
  },
  resultText: { fontSize: 20, fontWeight: '800', color: COLORS.amber, textAlign: 'center' },
});
