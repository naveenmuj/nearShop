import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, BackHandler, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import client from '../../lib/api';
import useMyShop from '../../hooks/useMyShop';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const PRIORITY_COLORS = {
  high: { bg: COLORS.redLight, text: COLORS.red, border: COLORS.red },
  medium: { bg: COLORS.amberLight, text: COLORS.amber, border: COLORS.amber },
  low: { bg: COLORS.greenLight, text: COLORS.green, border: COLORS.green },
};

export default function AdvisorScreen() {
  const { shopId } = useMyShop();
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { router.navigate('/(business)/more'); return true; }); return () => h.remove(); }, []);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [sRes] = await Promise.allSettled([client.get('/advisor/suggestions')]);
      if (sRes.status === 'fulfilled') setSuggestions(sRes.value.data?.suggestions ?? sRes.value.data ?? []);
      else setError('Failed to load suggestions');
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAction = (suggestion) => {
    if (suggestion.action_route) {
      router.navigate(suggestion.action_route);
    } else if (suggestion.action_url) {
      Linking.openURL(suggestion.action_url).catch(() => {});
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.navigate('/(business)/more')}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>AI Advisor</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} /> :
         error ? (
          <View style={s.errorWrap}>
            <Text style={s.empty}>{error}</Text>
            <TouchableOpacity onPress={loadData} style={s.retryBtn}><Text style={s.retryText}>Retry</Text></TouchableOpacity>
          </View>
        ) : null}

        {!loading && suggestions.length === 0 && !error && (
          <Text style={s.empty}>No suggestions right now. Keep running your shop!</Text>
        )}

        {!loading && suggestions.map((sg, i) => {
          const priority = (sg.priority || 'low').toLowerCase();
          const colors = PRIORITY_COLORS[priority] || PRIORITY_COLORS.low;
          return (
            <View key={sg.id || i} style={[s.card, { borderLeftWidth: 4, borderLeftColor: colors.border }]}>
              <View style={s.cardHeader}>
                <View style={[s.priBadge, { backgroundColor: colors.bg }]}>
                  <Text style={[s.priText, { color: colors.text }]}>{priority.toUpperCase()}</Text>
                </View>
                {sg.category && <Text style={s.cardCat}>{sg.category}</Text>}
              </View>
              <Text style={s.cardTitle}>{sg.title}</Text>
              <Text style={s.cardDesc}>{sg.description}</Text>
              {sg.impact && <Text style={s.cardImpact}>Potential impact: {sg.impact}</Text>}
              {(sg.action_label || sg.action_route || sg.action_url) && (
                <TouchableOpacity onPress={() => handleAction(sg)} style={[s.actionBtn, { backgroundColor: colors.bg }]}>
                  <Text style={[s.actionText, { color: colors.text }]}>{sg.action_label || 'Take Action'}</Text>
                </TouchableOpacity>
              )}
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
  errorWrap: { alignItems: 'center', marginTop: 40 },
  retryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.primaryLight },
  retryText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 12, ...SHADOWS.card },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  priBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  priText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  cardCat: { fontSize: 11, fontWeight: '600', color: COLORS.gray400, textTransform: 'uppercase' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.gray900, marginBottom: 4 },
  cardDesc: { fontSize: 13, color: COLORS.gray600, lineHeight: 19, marginBottom: 8 },
  cardImpact: { fontSize: 12, fontWeight: '600', color: COLORS.green, marginBottom: 10 },
  actionBtn: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  actionText: { fontSize: 13, fontWeight: '700' },
});
