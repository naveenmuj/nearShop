import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import useAuthStore from '../store/authStore';
import { COLORS } from '../constants/theme';

export default function Index() {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
  if (user?.active_role === 'business') return <Redirect href="/(business)/dashboard" />;
  return <Redirect href="/(customer)/home" />;
}
