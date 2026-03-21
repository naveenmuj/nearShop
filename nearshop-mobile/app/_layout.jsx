import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import useAuthStore from '../store/authStore';
import useLocationStore from '../store/locationStore';

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const requestLocation = useLocationStore((s) => s.requestLocation);

  useEffect(() => {
    initialize();
    requestLocation();
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(customer)" />
        <Stack.Screen name="(business)" />
      </Stack>
      <Toast />
    </>
  );
}
