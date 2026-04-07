import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE } from '../lib/api';

/**
 * OfflineIndicator - Shows a dismissible banner when the device or backend is offline.
 *
 * It listens to native network changes first, then uses a lightweight health check so
 * the app can distinguish between no internet and a reachable network with an unavailable API.
 */
export default function OfflineIndicator() {
  const insets = useSafeAreaInsets();
  const [isDeviceOffline, setIsDeviceOffline] = useState(false);
  const [isBackendOffline, setIsBackendOffline] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const slideAnim = useRef(new Animated.Value(-88)).current;
  const mountedRef = useRef(true);
  const visibleRef = useRef(false);
  const deviceOfflineRef = useRef(false);

  const isOffline = isDeviceOffline || isBackendOffline;
  const isVisible = isOffline && !isDismissed;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(`${API_BASE}/api/v1/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!mountedRef.current) {
        return;
      }

      setIsBackendOffline(!res.ok);
      if (res.ok) {
        setIsDismissed(false);
      }
    } catch {
      if (mountedRef.current) {
        setIsBackendOffline(true);
      }
    } finally {
      if (mountedRef.current) {
        setIsChecking(false);
      }
    }
  };

  const handleReconnect = async () => {
    setIsDismissed(false);
    await checkHealth();
  };

  useEffect(() => {
    const animateTo = (visible) => {
      Animated.timing(slideAnim, {
        toValue: visible ? 0 : -88,
        duration: 240,
        useNativeDriver: true,
      }).start(() => {
        visibleRef.current = visible;
      });
    };

    if (isVisible !== visibleRef.current) {
      animateTo(isVisible);
    }
  }, [isVisible, slideAnim]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = state.isConnected === false || state.isInternetReachable === false;
      deviceOfflineRef.current = offline;
      setIsDeviceOffline(offline);

      if (!offline) {
        setIsDismissed(false);
        checkHealth();
      }
    });

    checkHealth();

    const intervalId = setInterval(() => {
      if (!deviceOfflineRef.current) {
        checkHealth();
      }
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!isOffline) {
      setIsDismissed(false);
    }
  }, [isOffline]);

  if (!isVisible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          paddingTop: Math.max(10, insets.top + 8),
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.innerBanner}>
        <View style={styles.copyRow}>
          <Text style={styles.icon}>📡</Text>
          <View style={styles.copyBlock}>
            <Text style={styles.title}>{isDeviceOffline ? 'No internet connection' : 'Backend unreachable'}</Text>
            <Text style={styles.text}>
              {isDeviceOffline
                ? 'Reconnecting automatically when the network is back.'
                : 'Your network is online, but NearShop is not responding right now.'}
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={handleReconnect} activeOpacity={0.85} style={styles.primaryBtn}>
            {isChecking ? <ActivityIndicator size="small" color="#FFF7ED" /> : <Text style={styles.primaryBtnText}>Reconnect</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsDismissed(true)}
            activeOpacity={0.85}
            style={[styles.primaryBtn, styles.secondaryBtn]}
          >
            <Text style={styles.primaryBtnText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    backgroundColor: 'rgba(180, 83, 9, 0.96)',
  },
  innerBanner: {
    borderRadius: 18,
    backgroundColor: 'rgba(17, 24, 39, 0.16)',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  icon: {
    fontSize: 18,
    marginTop: 1,
  },
  copyBlock: {
    flex: 1,
  },
  title: {
    color: '#FFF7ED',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  text: {
    color: '#FFEDD5',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  actionsRow: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  primaryBtn: {
    minWidth: 94,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.3)',
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255, 247, 237, 0.14)',
  },
  primaryBtnText: {
    color: '#FFF7ED',
    fontSize: 12,
    fontWeight: '700',
  },
});
