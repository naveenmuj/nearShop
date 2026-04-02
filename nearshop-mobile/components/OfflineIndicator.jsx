import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { COLORS } from '../constants/theme';

/**
 * OfflineIndicator - Shows banner when device is offline
 * 
 * Automatically appears at top of screen when connection is lost
 * and disappears when connection is restored
 */
export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [slideAnim] = useState(new Animated.Value(-50));

  useEffect(() => {
    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !state.isConnected || !state.isInternetReachable;
      
      if (offline !== isOffline) {
        setIsOffline(offline);
        
        // Animate banner in/out
        Animated.timing(slideAnim, {
          toValue: offline ? 0 : -50,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    });

    return () => unsubscribe();
  }, [isOffline]);

  if (!isOffline) {
    return null;
  }

  return (
    <Animated.View 
      style={[
        styles.banner, 
        { transform: [{ translateY: slideAnim }] }
      ]}
    >
      <Text style={styles.icon}>📡</Text>
      <Text style={styles.text}>No internet connection</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.red || '#E24B4A',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
