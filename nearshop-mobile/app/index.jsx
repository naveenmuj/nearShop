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

  // Default to customer role if active_role is missing
  const role = user?.active_role || 'customer';
  if (role === 'business') return <Redirect href="/(business)/dashboard" />;
  return <Redirect href="/(customer)/home" />;
}
