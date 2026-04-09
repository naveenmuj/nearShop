import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, PanResponder, useWindowDimensions } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NETWORK_LOGGER_ENABLED } from '../constants/debugConfig';
import useAuthStore from '../store/authStore';
import useLocationStore from '../store/locationStore';
import useCartStore from '../store/cartStore';
import { ToastProvider, useToast } from '../components/ui/Toast';
import ConfirmDialogProvider from '../components/ui/ConfirmDialog/ConfirmDialogProvider';
import { PremiumAlertProvider, PremiumAlertContext, setAlertRef } from '../components/ui/PremiumAlert';
import { useContext } from 'react';
import pushService from '../lib/pushNotifications';
import OfflineIndicator from '../components/OfflineIndicator';

// Lazy-load network logger to prevent crash if module has issues
let NetworkLogger = null;
if (NETWORK_LOGGER_ENABLED) {
  try {
    const mod = require('react-native-network-logger');
    NetworkLogger = mod.default;
    if (typeof mod.startNetworkLogging === 'function') {
      mod.startNetworkLogging();
    }
  } catch (e) {
    console.warn('Network logger failed to initialize:', e?.message);
  }
}

const LOGGER_BUBBLE_SIZE = 40;
const LOGGER_EDGE_MARGIN = 12;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function NetworkLoggerOverlay() {
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const loggerEnabled = NETWORK_LOGGER_ENABLED && !!NetworkLogger;
  const initialBounds = {
    minX: LOGGER_EDGE_MARGIN,
    maxX: Math.max(LOGGER_EDGE_MARGIN, width - LOGGER_BUBBLE_SIZE - LOGGER_EDGE_MARGIN),
    minY: insets.top + 8,
    maxY: Math.max(insets.top + 8, height - insets.bottom - LOGGER_BUBBLE_SIZE - LOGGER_EDGE_MARGIN),
  };
  const initialPosition = { x: initialBounds.maxX, y: initialBounds.minY };
  const position = useRef(new Animated.ValueXY(initialPosition)).current;
  const lastOffset = useRef(initialPosition);
  const dragStart = useRef(initialPosition);
  const boundsRef = useRef({
    minX: LOGGER_EDGE_MARGIN,
    maxX: LOGGER_EDGE_MARGIN,
    minY: insets.top + 8,
    maxY: insets.top + 8,
  });

  const bounds = {
    minX: LOGGER_EDGE_MARGIN,
    maxX: Math.max(LOGGER_EDGE_MARGIN, width - LOGGER_BUBBLE_SIZE - LOGGER_EDGE_MARGIN),
    minY: insets.top + 8,
    maxY: Math.max(insets.top + 8, height - insets.bottom - LOGGER_BUBBLE_SIZE - LOGGER_EDGE_MARGIN),
  };
  boundsRef.current = bounds;

  useEffect(() => {
    const nextPosition = {
      x: clamp(lastOffset.current.x, bounds.minX, bounds.maxX),
      y: clamp(lastOffset.current.y, bounds.minY, bounds.maxY),
    };

    lastOffset.current = nextPosition;
    position.setValue(nextPosition);
  }, [bounds.maxX, bounds.maxY, bounds.minX, bounds.minY, position]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2,
      onPanResponderGrant: () => {
        position.stopAnimation((value) => {
          lastOffset.current = value;
          dragStart.current = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const activeBounds = boundsRef.current;
        position.setValue({
          x: clamp(dragStart.current.x + gestureState.dx, activeBounds.minX, activeBounds.maxX),
          y: clamp(dragStart.current.y + gestureState.dy, activeBounds.minY, activeBounds.maxY),
        });
      },
      onPanResponderRelease: (_, gestureState) => {
        const activeBounds = boundsRef.current;
        const nextPosition = {
          x: clamp(dragStart.current.x + gestureState.dx, activeBounds.minX, activeBounds.maxX),
          y: clamp(dragStart.current.y + gestureState.dy, activeBounds.minY, activeBounds.maxY),
        };
        lastOffset.current = nextPosition;
        position.setValue(nextPosition);
      },
      onPanResponderTerminate: (_, gestureState) => {
        const activeBounds = boundsRef.current;
        const nextPosition = {
          x: clamp(dragStart.current.x + gestureState.dx, activeBounds.minX, activeBounds.maxX),
          y: clamp(dragStart.current.y + gestureState.dy, activeBounds.minY, activeBounds.maxY),
        };
        lastOffset.current = nextPosition;
        position.setValue(nextPosition);
      },
    })
  ).current;

  if (!loggerEnabled) return null;

  return (
    <>
      {/* Floating bubble — always on screen */}
      <Animated.View
        style={[styles.bubble, { transform: position.getTranslateTransform() }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity onPress={() => setVisible(true)} activeOpacity={0.8} style={styles.bubbleButton}>
          <Text style={styles.bubbleText}>📡</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Full-screen logger modal */}
      <Modal visible={visible} animationType="slide" statusBarTranslucent>
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>API Network Logs</Text>
            <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕ Close</Text>
            </TouchableOpacity>
          </View>
          <NetworkLogger theme="dark" />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    width: LOGGER_BUBBLE_SIZE,
    height: LOGGER_BUBBLE_SIZE,
    borderRadius: LOGGER_BUBBLE_SIZE / 2,
    backgroundColor: 'rgba(30,30,30,0.85)',
    zIndex: 9999,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  bubbleButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: LOGGER_BUBBLE_SIZE / 2,
  },
  bubbleText: { fontSize: 18 },
  modalContainer: { flex: 1, backgroundColor: '#1a1a1a' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  closeBtn: { backgroundColor: '#333', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  closeBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});

// Expo Router error boundary — prevents white-screen crash
export function ErrorBoundary({ error, retry }) {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 32 }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>😵</Text>
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
        Something went wrong
      </Text>
      <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>
        {error?.message || 'An unexpected error occurred'}
      </Text>
      <TouchableOpacity
        onPress={retry}
        style={{ backgroundColor: '#7F77DD', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

// Component to sync alert ref for imperative API
function AlertRefSync() {
  const alertApi = useContext(PremiumAlertContext);
  useEffect(() => {
    setAlertRef(alertApi);
  }, [alertApi]);
  return null;
}

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const initCart = useCartStore((s) => s.initialize);
  const initLocation = useLocationStore((s) => s.initialize);
  const requestLocation = useLocationStore((s) => s.requestLocation);
  const startLiveTracking = useLocationStore((s) => s.startLiveTracking);
  const stopLiveTracking = useLocationStore((s) => s.stopLiveTracking);

  useEffect(() => {
    const init = async () => {
      try {
        // Initialize auth first
        await initialize();
        // Load persisted cart count and items early for all screens.
        await initCart();
        // Then initialize location
        await initLocation();
        // Finally check if location needs requesting
        const { lat } = useLocationStore.getState();
        if (!lat) {
          await requestLocation();
        }
        await startLiveTracking();
      } catch (err) {
        console.error('Initialization error:', err);
      }
    };
    init();
    return () => {
      stopLiveTracking().catch(() => {});
    };
  }, [initialize, initCart, initLocation, requestLocation, startLiveTracking, stopLiveTracking]);

  // Initialize push notifications when user is authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const initPush = async () => {
        try {
          await pushService.initialize();
        } catch (err) {
          console.error('Push notification init error:', err);
        }
      };
      initPush();
    }

    // Cleanup on unmount
    return () => {
      pushService.cleanup();
    };
  }, [isAuthenticated]);

  return (
    <ToastProvider>
      <PremiumAlertProvider>
        <ConfirmDialogProvider>
          <AlertRefSync />
          <OfflineIndicator />
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(customer)" />
            <Stack.Screen name="(business)" />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
          </Stack>
          <NetworkLoggerOverlay />
        </ConfirmDialogProvider>
      </PremiumAlertProvider>
    </ToastProvider>
  );
}
