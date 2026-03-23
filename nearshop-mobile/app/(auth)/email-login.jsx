import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform,
  StyleSheet, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { signInWithEmail, registerWithEmail, signInWithGoogle } from '../../lib/firebaseAuth';
import useAuthStore from '../../store/authStore';
import { COLORS, SHADOWS } from '../../constants/theme';

export default function EmailLoginScreen() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const navigateAfterAuth = (data) => {
    login({ access_token: data.access_token, refresh_token: data.refresh_token }, data.user);
    if (data.is_new_user || !data.user?.name) {
      router.replace('/(auth)/select-role');
    } else if (data.user?.active_role === 'business') {
      router.replace('/(business)/dashboard');
    } else {
      router.replace('/(customer)/home');
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) {
      Toast.show({ type: 'error', text1: 'Fill in all fields' });
      return;
    }
    if (isRegister && password !== confirm) {
      Toast.show({ type: 'error', text1: 'Passwords do not match' });
      return;
    }
    if (password.length < 6) {
      Toast.show({ type: 'error', text1: 'Password must be at least 6 characters' });
      return;
    }
    setLoading(true);
    try {
      const data = isRegister
        ? await registerWithEmail(email, password)
        : await signInWithEmail(email, password);
      navigateAfterAuth(data);
    } catch (err) {
      const msg = friendlyError(err.code) || err.message;
      Toast.show({ type: 'error', text1: isRegister ? 'Registration failed' : 'Sign-in failed', text2: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const data = await signInWithGoogle();
      navigateAfterAuth(data);
    } catch (err) {
      if (err.code !== 'SIGN_IN_CANCELLED') {
        Toast.show({ type: 'error', text1: 'Google Sign-In failed', text2: err.message });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const isValid = email.includes('@') && password.length >= 6 &&
    (!isRegister || confirm === password);
  const anyLoading = loading || googleLoading;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{isRegister ? 'Create account' : 'Sign in'}</Text>
          <Text style={styles.subtitle}>Use your email and password</Text>

          {/* Sign in / Register tab */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              onPress={() => { setIsRegister(false); setConfirm(''); }}
              style={[styles.tab, !isRegister && styles.tabActive]}
            >
              <Text style={[styles.tabText, !isRegister && styles.tabTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setIsRegister(true); setConfirm(''); }}
              style={[styles.tab, isRegister && styles.tabActive]}
            >
              <Text style={[styles.tabText, isRegister && styles.tabTextActive]}>Register</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.gray400}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={COLORS.gray400}
              secureTextEntry
              style={styles.input}
            />

            {isRegister && (
              <>
                <Text style={[styles.label, { marginTop: 14 }]}>Confirm password</Text>
                <TextInput
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Repeat your password"
                  placeholderTextColor={COLORS.gray400}
                  secureTextEntry
                  style={[styles.input, confirm && confirm !== password ? styles.inputError : null]}
                />
              </>
            )}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={anyLoading || !isValid}
              activeOpacity={0.85}
              style={[styles.btn, { backgroundColor: isValid ? COLORS.primary : COLORS.gray200, marginTop: 20 }]}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={[styles.btnText, { color: isValid ? COLORS.white : COLORS.gray400 }]}>
                  {isRegister ? 'Create account →' : 'Sign in →'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

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
            {googleLoading ? (
              <ActivityIndicator color={COLORS.gray700} />
            ) : (
              <>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#4285F4' }}>G</Text>
                <Text style={styles.socialBtnText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Phone OTP */}
          <TouchableOpacity
            onPress={() => router.replace('/(auth)/login')}
            disabled={anyLoading}
            activeOpacity={0.85}
            style={[styles.socialBtn, { marginBottom: 8 }]}
          >
            <Text style={{ fontSize: 18 }}>📱</Text>
            <Text style={styles.socialBtnText}>Continue with Phone OTP</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function friendlyError(code) {
  const map = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/weak-password': 'Password is too weak.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/invalid-credential': 'Invalid email or password.',
  };
  return map[code] || null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  kav: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 },
  backBtn: { marginBottom: 20, alignSelf: 'flex-start' },
  backText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.gray900, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.gray500, marginBottom: 20 },
  tabRow: {
    flexDirection: 'row', backgroundColor: COLORS.gray100,
    borderRadius: 12, padding: 4, marginBottom: 16,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: COLORS.white, ...SHADOWS.card },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.gray400 },
  tabTextActive: { color: COLORS.primary },
  card: { backgroundColor: COLORS.white, borderRadius: 24, padding: 24, ...SHADOWS.card },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.gray600, marginBottom: 8 },
  input: {
    height: 52, paddingHorizontal: 16, fontSize: 16, fontWeight: '500',
    backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.gray200, color: COLORS.gray900,
  },
  inputError: { borderColor: '#ef4444' },
  btn: { height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.gray200 },
  dividerText: { paddingHorizontal: 12, fontSize: 12, color: COLORS.gray400 },
  socialBtn: {
    height: 52, borderRadius: 14, borderWidth: 1, borderColor: COLORS.gray200,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, marginBottom: 12, backgroundColor: COLORS.white, ...SHADOWS.card,
  },
  socialBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.gray700 },
});
