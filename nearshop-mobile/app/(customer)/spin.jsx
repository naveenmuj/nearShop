import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import SpinWheel from '../../components/SpinWheel';
import { getDailySpinStatus, performDailySpin } from '../../lib/engagement';
import { useToast } from '../../components/ui/Toast';
import { COLORS, SHADOWS } from '../../constants/theme';

function CountdownTimer({ nextSpin }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const calc = () => {
      const diff = new Date(nextSpin) - Date.now();
      if (diff <= 0) { setTimeLeft('Available now!'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [nextSpin]);

  return <Text style={styles.countdown}>{timeLeft}</Text>;
}

export default function SpinScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastPrize, setLastPrize] = useState(null);

  const loadStatus = async () => {
    try {
      const r = await getDailySpinStatus();
      setStatus(r.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadStatus(); }, []);

  const handleSpin = async () => {
    const r = await performDailySpin();
    const data = r.data;
    setLastPrize(data.prize);
    await loadStatus();
    // Show coin toast if coins were awarded
    if (data.coins) {
      showToast({ type: 'coins', message: `You won: ${data.prize}!`, coins: data.coins });
    } else if (data.prize) {
      showToast({ type: 'success', message: `You won: ${data.prize}!` });
    }
    return data;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Daily Spin</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Streak */}
        {status?.streak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 {status.streak} day streak!</Text>
          </View>
        )}

        <Text style={styles.subtitle}>
          {status?.available
            ? 'Spin to win coins every day!'
            : 'Next spin available in:'}
        </Text>

        {!status?.available && status?.next_spin_available && (
          <CountdownTimer nextSpin={status.next_spin_available} />
        )}

        <SpinWheel
          onSpin={handleSpin}
          disabled={!loading && !status?.available}
        />

        <View style={styles.prizes}>
          <Text style={styles.prizesTitle}>Possible Prizes</Text>
          {[
            { label: '5 Coins',     odds: '40%' },
            { label: '10 Coins',    odds: '25%' },
            { label: '20 Coins',    odds: '15%' },
            { label: '50 Coins',    odds: '10%' },
            { label: '100 Coins',   odds: '5%' },
            { label: '2× Multiplier', odds: '3%' },
            { label: '200 Coins',   odds: '2%' },
          ].map(p => (
            <View key={p.label} style={styles.prizeRow}>
              <Text style={styles.prizeLabel}>{p.label}</Text>
              <Text style={styles.prizeOdds}>{p.odds}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.gray200,
    backgroundColor: '#fff',
  },
  back: { width: 60 },
  backText: { color: COLORS.primary, fontSize: 18 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.gray900 },
  scroll: { alignItems: 'center', paddingBottom: 32, paddingTop: 20 },
  streakBadge: {
    backgroundColor: '#FFF7ED', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8,
    borderWidth: 1, borderColor: '#F97316', marginBottom: 12,
  },
  streakText: { fontSize: 15, fontWeight: '700', color: '#EA580C' },
  subtitle: { fontSize: 14, color: COLORS.gray500, marginBottom: 8 },
  countdown: { fontSize: 28, fontWeight: '800', color: COLORS.primary, letterSpacing: 2, marginBottom: 16 },
  prizes: {
    width: '85%', backgroundColor: '#fff', borderRadius: 16,
    padding: 16, marginTop: 24, borderWidth: 1, borderColor: COLORS.gray200,
  },
  prizesTitle: { fontSize: 15, fontWeight: '700', color: COLORS.gray900, marginBottom: 12 },
  prizeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  prizeLabel: { fontSize: 14, color: COLORS.gray700, fontWeight: '500' },
  prizeOdds: { fontSize: 14, color: COLORS.gray400 },
});
