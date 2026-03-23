import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import NetworkLogger, { startNetworkLogging } from 'react-native-network-logger';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NETWORK_LOGGER_ENABLED } from '../constants/debugConfig';
import useAuthStore from '../store/authStore';
import useLocationStore from '../store/locationStore';

if (NETWORK_LOGGER_ENABLED) {
  startNetworkLogging();
}

function NetworkLoggerOverlay() {
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();

  if (!NETWORK_LOGGER_ENABLED) return null;

  return (
    <>
      {/* Floating bubble — always on screen */}
      <TouchableOpacity
        style={[styles.bubble, { top: insets.top + 8 }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.bubbleText}>📡</Text>
      </TouchableOpacity>

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
    right: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30,30,30,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
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

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const initLocation = useLocationStore((s) => s.initialize);
  const requestLocation = useLocationStore((s) => s.requestLocation);

  useEffect(() => {
    initialize();
    initLocation().then(() => {
      const { lat } = useLocationStore.getState();
      if (!lat) requestLocation();
    });
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(business)" />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
      </Stack>
      <Toast />
      <NetworkLoggerOverlay />
    </>
  );
}
