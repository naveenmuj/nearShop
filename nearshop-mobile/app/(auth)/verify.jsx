import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { verifyFirebaseOtp, sendFirebaseOtp, getConfirmation } from '../../lib/firebaseAuth';
import useAuthStore from '../../store/authStore';
import { COLORS, SHADOWS } from '../../constants/theme';

export default function VerifyScreen() {
  const { phone } = useLocalSearchParams();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const inputs = useRef([]);
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  useEffect(() => {
    // Redirect back if no confirmation session (e.g. direct URL access)
    if (!getConfirmation()) {
      router.replace('/(auth)/login');
      return;
    }
    setTimeout(() => inputs.current[0]?.focus(), 300);
    const iv = setInterval(() => setTimer((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(iv);
  }, []);

  const handleChange = (text, index) => {
    const val = text.replace(/\D/g, '').slice(0, 1);
    const next = [...otp];
    next[index] = val;
    setOtp(next);
    if (val && index < 5) inputs.current[index + 1]?.focus();
    if (next.every(Boolean) && next.join('').length === 6) {
      handleVerify(next.join(''));
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = '';
      setOtp(next);
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (code) => {
    if (!code || code.length !== 6) return;
    setLoading(true);
    try {
      const data = await verifyFirebaseOtp(code);
      // data = { user, access_token, refresh_token, is_new_user }
      await login(
        { access_token: data.access_token, refresh_token: data.refresh_token },
        data.user,
      );
      if (data.is_new_user || !data.user?.name) {
        router.replace('/(auth)/select-role');
      } else if (data.user?.active_role === 'business') {
        router.replace('/(business)/dashboard');
      } else {
        router.replace('/(customer)/home');
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Invalid OTP',
        text2: err.message || 'Please try again',
      });
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;
    try {
      await sendFirebaseOtp(phone);
      setTimer(60);
      Toast.show({ type: 'success', text1: 'OTP resent!' });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Failed to resend', text2: err.message });
    }
  };

  const isComplete = otp.every(Boolean);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.subtitle}>Sent to {phone}</Text>

        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(r) => { inputs.current[i] = r; }}
              value={digit}
              onChangeText={(t) => handleChange(t, i)}
              onKeyPress={(e) => handleKeyPress(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
            />
          ))}
        </View>

        <TouchableOpacity
          onPress={() => handleVerify(otp.join(''))}
          disabled={loading || !isComplete}
          activeOpacity={0.85}
          style={[styles.btn, { backgroundColor: isComplete ? COLORS.primary : COLORS.gray200 }]}
        >
          <Text style={[styles.btnText, { color: isComplete ? COLORS.white : COLORS.gray400 }]}>
            {loading ? 'Verifying…' : 'Verify →'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleResend} style={styles.resendWrap}>
          {timer > 0 ? (
            <Text style={styles.timerText}>Resend OTP in {timer}s</Text>
          ) : (
            <Text style={styles.resendText}>Resend OTP</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 20 },
  backBtn: { marginBottom: 32, alignSelf: 'flex-start' },
  backText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.gray900, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.gray500, marginBottom: 36 },
  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32, gap: 8 },
  otpBox: {
    flex: 1, height: 60, borderRadius: 16, borderWidth: 1.5,
    borderColor: COLORS.gray200, backgroundColor: COLORS.white,
    textAlign: 'center', fontSize: 24, fontWeight: '700', color: COLORS.gray900,
  },
  otpBoxFilled: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  btn: { height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  btnText: { fontSize: 16, fontWeight: '700' },
  resendWrap: { alignItems: 'center' },
  timerText: { fontSize: 14, color: COLORS.gray400 },
  resendText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
});
