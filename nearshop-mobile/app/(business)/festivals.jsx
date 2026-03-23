import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, BackHandler, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import client from '../../lib/api';
import useMyShop from '../../hooks/useMyShop';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

export default function FestivalsScreen() {
  const { shopId } = useMyShop();
  const [festivals, setFestivals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { router.navigate('/(business)/more'); return true; }); return () => h.remove(); }, []);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [fRes] = await Promise.allSettled([client.get('/marketing/festivals')]);
      if (fRes.status === 'fulfilled') setFestivals(fRes.value.data?.festivals ?? fRes.value.data ?? []);
      else setError('Failed to load festivals');
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getUrgency = (f) => {
    const daysLeft = f.days_left ?? Math.ceil((new Date(f.date) - new Date()) / 86400000);
    if (daysLeft <= 3) return { label: 'Urgent', color: COLORS.red, bg: COLORS.redLight };
    if (daysLeft <= 7) return { label: 'This Week', color: COLORS.amber, bg: COLORS.amberLight };
    if (daysLeft <= 14) return { label: 'Soon', color: COLORS.blue, bg: COLORS.blueLight };
    return { label: `${daysLeft}d away`, color: COLORS.green, bg: COLORS.greenLight };
  };

  const shareOnWhatsApp = (f) => {
    const text = `${f.name} is coming! Visit our shop for special ${f.name} deals and offers. Don't miss out!`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() => {});
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.navigate('/(business)/more')}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>Festival Calendar</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} /> :
         error ? <Text style={s.empty}>{error}</Text> : null}

        {!loading && festivals.length === 0 && !error && (
          <Text style={s.empty}>No upcoming festivals</Text>
        )}

        {!loading && festivals.map((f, i) => {
          const urg = getUrgency(f);
          const daysLeft = f.days_left ?? Math.ceil((new Date(f.date) - new Date()) / 86400000);
          return (
            <View key={f.id || i} style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.festName}>{f.name}</Text>
                  <Text style={s.festDate}>
                    {f.date ? new Date(f.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </Text>
                </View>
                <View style={[s.urgBadge, { backgroundColor: urg.bg }]}>
                  <Text style={[s.urgText, { color: urg.color }]}>{urg.label}</Text>
                </View>
              </View>

              {f.description && <Text style={s.festDesc}>{f.description}</Text>}

              {f.suggested_categories && f.suggested_categories.length > 0 && (
                <View style={s.tagRow}>
                  {f.suggested_categories.map((cat, ci) => (
                    <View key={ci} style={s.tag}><Text style={s.tagText}>{cat}</Text></View>
                  ))}
                </View>
              )}

              <View style={s.actRow}>
                <TouchableOpacity onPress={() => router.navigate('/(business)/deals')} style={s.actBtn}>
                  <Text style={s.actBtnText}>Create Deal</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => shareOnWhatsApp(f)} style={[s.actBtn, { backgroundColor: '#25D366' }]}>
                  <Text style={[s.actBtnText, { color: COLORS.white }]}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  back: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.gray900 },
  content: { padding: 16, paddingBottom: 40 },
  empty: { textAlign: 'center', color: COLORS.gray400, marginTop: 40 },
  card: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 12, ...SHADOWS.card },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  festName: { fontSize: 16, fontWeight: '700', color: COLORS.gray900 },
  festDate: { fontSize: 13, color: COLORS.gray500, marginTop: 2 },
  urgBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginLeft: 10 },
  urgText: { fontSize: 12, fontWeight: '700' },
  festDesc: { fontSize: 13, color: COLORS.gray600, lineHeight: 19, marginBottom: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tag: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  actRow: { flexDirection: 'row', gap: 10 },
  actBtn: { flex: 1, backgroundColor: COLORS.primaryLight, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  actBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
});
