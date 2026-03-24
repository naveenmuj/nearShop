import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { sendFirebaseOtp, signInWithGoogle, signInWithApple } from '../../lib/firebaseAuth';
import useAuthStore from '../../store/authStore';
import { COLORS, SHADOWS } from '../../constants/theme';

export default function LoginScreen() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState(null); // 'google' | 'apple'
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const navigateAfterAuth = async (data) => {
    try {
      // Ensure login completes before navigating
      await login({ access_token: data.access_token, refresh_token: data.refresh_token }, data.user);

      // Add small delay to ensure state is updated
      await new Promise(resolve => setTimeout(resolve, 100));

      if (data.is_new_user || !data.user?.name) {
        router.replace('/(auth)/select-role');
      } else if (data.user?.active_role === 'business') {
        router.replace('/(business)/dashboard');
      } else {
        router.replace('/(customer)/home');
      }
    } catch (err) {
      console.error('Navigation after auth failed:', err);
      Toast.show({
        type: 'error',
        text1: 'Setup failed',
        text2: 'Could not save login. Please try again.'
      });
      setLoadingProvider(null);
    }
  };

  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      Toast.show({ type: 'error', text1: 'Enter a valid 10-digit number' });
      return;
    }
    setLoading(true);
    try {
      const formattedPhone = '+91' + phone;
      await sendFirebaseOtp(formattedPhone);
      router.push({ pathname: '/(auth)/verify', params: { phone: formattedPhone } });
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Could not send OTP',
        text2: err.message || 'Check the phone number and try again',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoadingProvider('google');
    try {
      const data = await signInWithGoogle();
      navigateAfterAuth(data);
    } catch (err) {
      if (err.code !== 'SIGN_IN_CANCELLED' && err.code !== 'auth/popup-closed-by-user') {
        Toast.show({ type: 'error', text1: 'Google Sign-In failed', text2: err.message });
      }
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleApple = async () => {
    if (Platform.OS !== 'ios') {
      Toast.show({ type: 'info', text1: 'Apple Sign-In', text2: 'Only available on iOS devices' });
      return;
    }
    setLoadingProvider('apple');
    try {
      const data = await signInWithApple();
      navigateAfterAuth(data);
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Apple Sign-In failed', text2: err.message });
    } finally {
      setLoadingProvider(null);
    }
  };

  const isValid = phone.length === 10;
  const anyLoading = loading || loadingProvider !== null;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <View style={styles.inner}>
          {/* Logo */}
          <View style={styles.logoWrap}>
            <View style={styles.logoIcon}>
              <Text style={{ fontSize: 44 }}>🛍️</Text>
            </View>
            <Text style={styles.appName}>NearShop</Text>
            <Text style={styles.tagline}>Discover amazing local shops near you</Text>
          </View>

          <View style={styles.card}>
            {/* Phone OTP */}
            <Text style={styles.label}>Mobile number</Text>
            <View style={styles.phoneRow}>
              <View style={styles.countryCode}>
                <Text style={styles.countryText}>🇮🇳 +91</Text>
              </View>
              <TextInput
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                placeholder="Enter 10-digit number"
                placeholderTextColor={COLORS.gray400}
                keyboardType="phone-pad"
                maxLength={10}
                style={styles.input}
              />
            </View>

            <TouchableOpacity
              onPress={handleSendOtp}
              disabled={anyLoading || !isValid}
              activeOpacity={0.85}
              style={[styles.btn, { backgroundColor: isValid ? COLORS.primary : COLORS.gray200 }]}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={[styles.btnText, { color: isValid ? COLORS.white : COLORS.gray400 }]}>
                  Send OTP →
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google */}
            <TouchableOpacity
              onPress={handleGoogle}
              disabled={anyLoading}
              activeOpacity={0.85}
              style={styles.socialBtn}
            >
              {loadingProvider === 'google' ? (
                <ActivityIndicator color={COLORS.gray700} />
              ) : (
                <>
                  <GoogleIcon />
                  <Text style={styles.socialBtnText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Apple */}
            <TouchableOpacity
              onPress={handleApple}
              disabled={anyLoading}
              activeOpacity={0.85}
              style={[styles.socialBtn, styles.appleBtnDark]}
            >
              {loadingProvider === 'apple' ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <AppleIcon />
                  <Text style={[styles.socialBtnText, { color: COLORS.white }]}>
                    {Platform.OS === 'ios' ? 'Continue with Apple' : 'Apple (iOS only)'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Email */}
            <TouchableOpacity
              onPress={() => router.push('/(auth)/email-login')}
              disabled={anyLoading}
              activeOpacity={0.85}
              style={styles.emailBtn}
            >
              <Text style={styles.emailBtnText}>Continue with Email</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            By continuing, you agree to our Terms & Privacy Policy
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function GoogleIcon() {
  return <Text style={{ fontSize: 18, fontWeight: '700', color: '#4285F4' }}>G</Text>;
}

function AppleIcon() {
  return <Text style={{ fontSize: 20, color: '#fff' }}></Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  kav: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  logoWrap: { alignItems: 'center', marginBottom: 32 },
  logoIcon: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    ...SHADOWS.card,
  },
  appName: { fontSize: 32, fontWeight: '700', color: COLORS.primary, letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: COLORS.gray500, marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: COLORS.white, borderRadius: 24, padding: 24, ...SHADOWS.card },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.gray600, marginBottom: 10 },
  phoneRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  countryCode: {
    height: 52, paddingHorizontal: 14, borderRadius: 14,
    backgroundColor: COLORS.gray50, borderWidth: 1, borderColor: COLORS.gray200,
    justifyContent: 'center',
  },
  countryText: { fontSize: 15, color: COLORS.gray700, fontWeight: '500' },
  input: {
    flex: 1, height: 52, paddingHorizontal: 16, fontSize: 17, fontWeight: '500',
    backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.gray200, color: COLORS.gray900,
  },
  btn: { height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  btnText: { fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.gray200 },
  dividerText: { paddingHorizontal: 12, fontSize: 12, color: COLORS.gray400 },
  socialBtn: {
    height: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.gray200,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginBottom: 10, backgroundColor: COLORS.white,
  },
  appleBtnDark: { backgroundColor: '#000', borderColor: '#000' },
  socialBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.gray700 },
  emailBtn: {
    height: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  emailBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  footer: { textAlign: 'center', marginTop: 24, fontSize: 12, color: COLORS.gray400, lineHeight: 18 },
});
