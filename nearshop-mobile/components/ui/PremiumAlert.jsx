/**
 * Premium Alert System
 * Beautiful, animated alerts to replace native Alert.alert
 * 
 * Usage:
 *   import { alert } from '../../components/ui/PremiumAlert';
 *   
 *   // Simple alert
 *   alert.show({ title: 'Success', message: 'Your order has been placed!' });
 *   
 *   // Error alert
 *   alert.error({ title: 'Error', message: 'Something went wrong' });
 *   
 *   // Confirm dialog
 *   const confirmed = await alert.confirm({ 
 *     title: 'Delete Account', 
 *     message: 'Are you sure?',
 *     confirmText: 'Delete',
 *     variant: 'danger'
 *   });
 */

import { createContext, useState, useRef, useCallback, useEffect, useContext } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Pressable,
  Dimensions,
  Easing,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SHADOWS } from '../../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');

// ═══════════════════════════════════════════════════════════════════════════════
// ALERT TYPES & CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════════
const ALERT_TYPES = {
  success: {
    icon: '✅',
    emoji: '🎉',
    gradient: ['#10B981', '#059669'],
    bg: '#ECFDF5',
    accent: '#059669',
    haptic: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  },
  error: {
    icon: '❌',
    emoji: '😔',
    gradient: ['#EF4444', '#DC2626'],
    bg: '#FEF2F2',
    accent: '#DC2626',
    haptic: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  },
  warning: {
    icon: '⚠️',
    emoji: '🤔',
    gradient: ['#F59E0B', '#D97706'],
    bg: '#FFFBEB',
    accent: '#D97706',
    haptic: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  },
  info: {
    icon: 'ℹ️',
    emoji: '💡',
    gradient: ['#3B82F6', '#2563EB'],
    bg: '#EFF6FF',
    accent: '#2563EB',
    haptic: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  },
  confirm: {
    icon: '❓',
    emoji: '🤷',
    gradient: ['#8B5CF6', '#7C3AED'],
    bg: '#F5F3FF',
    accent: '#7C3AED',
    haptic: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  },
  danger: {
    icon: '🗑️',
    emoji: '⚠️',
    gradient: ['#EF4444', '#B91C1C'],
    bg: '#FEF2F2',
    accent: '#DC2626',
    haptic: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED ICON COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function AnimatedIcon({ type, config }) {
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  
  useEffect(() => {
    // Entry animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(200),
        type === 'error' ? 
          // Shake for error
          Animated.sequence([
            Animated.timing(rotateAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
            Animated.timing(rotateAnim, { toValue: -1, duration: 50, useNativeDriver: true }),
            Animated.timing(rotateAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
            Animated.timing(rotateAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
          ])
        : type === 'success' ?
          // Bounce for success
          Animated.sequence([
            Animated.timing(bounceAnim, { toValue: -10, duration: 150, useNativeDriver: true }),
            Animated.timing(bounceAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
            Animated.timing(bounceAnim, { toValue: -5, duration: 100, useNativeDriver: true }),
            Animated.timing(bounceAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
          ])
        :
          // Subtle pulse for others
          Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 1.1, duration: 200, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
          ])
      ])
    ]).start();
  }, [type]);
  
  const rotate = rotateAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-15deg', '0deg', '15deg'],
  });
  
  return (
    <View style={[styles.iconContainer, { backgroundColor: config.bg }]}>
      <Animated.View style={{
        transform: [
          { scale: scaleAnim },
          { translateY: bounceAnim },
          { rotate },
        ],
      }}>
        <View style={[styles.iconCircle, { backgroundColor: config.accent + '20' }]}>
          <Text style={styles.iconText}>{config.emoji}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED BUTTON
// ═══════════════════════════════════════════════════════════════════════════════
function AnimatedButton({ label, onPress, variant = 'primary', color, style, delay = 0 }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      delay,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [delay]);
  
  const handlePressIn = () => {
    Animated.spring(pressAnim, { toValue: 0.95, useNativeDriver: true, friction: 8 }).start();
  };
  
  const handlePressOut = () => {
    Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
  };
  
  const isPrimary = variant === 'primary';
  const isDestructive = variant === 'destructive';
  
  return (
    <Animated.View style={[{ transform: [{ scale: Animated.multiply(scaleAnim, pressAnim) }] }, style]}>
      <TouchableOpacity
        style={[
          styles.button,
          isPrimary && { backgroundColor: color || COLORS.primary },
          isDestructive && { backgroundColor: '#DC2626' },
          !isPrimary && !isDestructive && styles.buttonSecondary,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <Text style={[
          styles.buttonText,
          isPrimary && styles.buttonTextPrimary,
          isDestructive && styles.buttonTextPrimary,
          !isPrimary && !isDestructive && styles.buttonTextSecondary,
        ]} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM ALERT CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════
export const PremiumAlertContext = createContext({
  show: () => {},
  success: () => {},
  error: () => {},
  warning: () => {},
  info: () => {},
  confirm: async () => false,
});

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM ALERT PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════
export function PremiumAlertProvider({ children }) {
  const [alertData, setAlertData] = useState(null);
  const resolveRef = useRef(null);
  
  // Animations
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.8)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(50)).current;
  
  const animateIn = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, tension: 65, friction: 9, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(cardTranslateY, { toValue: 0, tension: 65, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);
  
  const animateOut = useCallback((callback) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(cardScale, { toValue: 0.9, duration: 150, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(cardTranslateY, { toValue: 30, duration: 150, useNativeDriver: true }),
    ]).start(callback);
  }, []);
  
  const resetAnimations = useCallback(() => {
    backdropOpacity.setValue(0);
    cardScale.setValue(0.8);
    cardOpacity.setValue(0);
    cardTranslateY.setValue(50);
  }, []);

  // Show alert (non-blocking)
  const showAlert = useCallback((options) => {
    const {
      title = '',
      message = '',
      type = 'info',
      buttons = [{ text: 'OK', style: 'primary' }],
      dismissable = true,
    } = options;
    
    resetAnimations();
    setAlertData({ title, message, type, buttons, dismissable, isConfirm: false });
    
    const config = ALERT_TYPES[type] || ALERT_TYPES.info;
    config.haptic().catch(() => {});
    
    setTimeout(animateIn, 10);
  }, [animateIn, resetAnimations]);
  
  // Confirm alert (blocking, returns promise)
  const confirmAlert = useCallback((options) => {
    return new Promise((resolve) => {
      const {
        title = 'Confirm',
        message = 'Are you sure?',
        type = 'confirm',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        variant = 'default', // 'default' | 'danger'
        dismissable = true,
      } = options;
      
      resolveRef.current = resolve;
      
      const buttons = [
        { text: cancelText, style: 'secondary', value: false },
        { text: confirmText, style: variant === 'danger' ? 'destructive' : 'primary', value: true },
      ];
      
      resetAnimations();
      setAlertData({ title, message, type: variant === 'danger' ? 'danger' : type, buttons, dismissable, isConfirm: true });
      
      const config = ALERT_TYPES[variant === 'danger' ? 'danger' : type] || ALERT_TYPES.confirm;
      config.haptic().catch(() => {});
      
      setTimeout(animateIn, 10);
    });
  }, [animateIn, resetAnimations]);

  // Shorthand methods
  const success = useCallback((opts) => showAlert({ ...opts, type: 'success' }), [showAlert]);
  const error = useCallback((opts) => showAlert({ ...opts, type: 'error' }), [showAlert]);
  const warning = useCallback((opts) => showAlert({ ...opts, type: 'warning' }), [showAlert]);
  const info = useCallback((opts) => showAlert({ ...opts, type: 'info' }), [showAlert]);
  
  const handleButtonPress = (button) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    
    animateOut(() => {
      setAlertData(null);
      
      if (alertData?.isConfirm && resolveRef.current) {
        resolveRef.current(button.value);
        resolveRef.current = null;
      }
      
      if (button.onPress) {
        button.onPress();
      }
    });
  };
  
  const handleBackdropPress = () => {
    if (!alertData?.dismissable) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    
    animateOut(() => {
      setAlertData(null);
      
      if (alertData?.isConfirm && resolveRef.current) {
        resolveRef.current(false);
        resolveRef.current = null;
      }
    });
  };
  
  const config = alertData ? (ALERT_TYPES[alertData.type] || ALERT_TYPES.info) : ALERT_TYPES.info;
  
  return (
    <PremiumAlertContext.Provider value={{ show: showAlert, success, error, warning, info, confirm: confirmAlert }}>
      {children}
      
      <Modal
        visible={!!alertData}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={handleBackdropPress}
      >
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
          
          <Animated.View style={[
            styles.card,
            {
              transform: [
                { scale: cardScale },
                { translateY: cardTranslateY },
              ],
              opacity: cardOpacity,
            },
          ]}>
            {/* Icon Header */}
            <AnimatedIcon type={alertData?.type} config={config} />
            
            {/* Content */}
            <View style={styles.content}>
              <Text style={[styles.title, { color: config.accent }]}>
                {alertData?.title}
              </Text>
              
              {!!alertData?.message && (
                <Text style={styles.message}>{alertData.message}</Text>
              )}
            </View>
            
            {/* Buttons */}
            <View style={styles.buttonRow}>
              {alertData?.buttons?.map((button, index) => (
                <AnimatedButton
                  key={index}
                  label={button.text}
                  variant={button.style}
                  color={config.accent}
                  onPress={() => handleButtonPress(button)}
                  delay={index * 50}
                />
              ))}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </PremiumAlertContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════
export function usePremiumAlert() {
  return useContext(PremiumAlertContext);
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPERATIVE API (for use outside React components)
// ═══════════════════════════════════════════════════════════════════════════════
let alertRef = null;

export function setAlertRef(ref) {
  alertRef = ref;
}

export const alert = {
  show: (opts) => alertRef?.show(opts),
  success: (opts) => alertRef?.success(opts),
  error: (opts) => alertRef?.error(opts),
  warning: (opts) => alertRef?.warning(opts),
  info: (opts) => alertRef?.info(opts),
  confirm: (opts) => alertRef?.confirm(opts) ?? Promise.resolve(false),
};

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
    ...SHADOWS.cardHover,
  },
  iconContainer: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 8,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 42,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: COLORS.gray600,
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 10,
    justifyContent: 'center',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  buttonSecondary: {
    backgroundColor: COLORS.gray100,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  buttonTextPrimary: {
    color: '#fff',
  },
  buttonTextSecondary: {
    color: COLORS.gray700,
  },
});

export default PremiumAlertProvider;
