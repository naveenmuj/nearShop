import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, BackHandler, Linking, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import client from '../../lib/api';
import { toast } from '../../components/ui/Toast';
import useMyShop from '../../hooks/useMyShop';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

export default function FestivalsScreen() {
  const { shopId } = useMyShop();
  const [festivals, setFestivals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { router.navigate('/(business)/more'); return true; }); return () => h.remove(); }, []);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const res = await client.get('/marketing/festivals');
      setFestivals(res.data?.festivals ?? res.data ?? []);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load festivals');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getUrgency = (f) => {
    const days = f.days_away ?? Math.ceil((new Date(f.date) - new Date()) / 86400000);
    if (days <= 0) return { label: '🔴 Happening Now', color: '#DC2626', bg: '#FEE2E2' };
    if (days <= 3) return { label: `🔥 ${days}d away`, color: '#DC2626', bg: '#FEE2E2' };
    if (days <= 7) return { label: `⚡ ${days}d away`, color: '#D97706', bg: '#FEF3C7' };
    if (days <= 14) return { label: `📅 ${days}d away`, color: '#2563EB', bg: '#DBEAFE' };
    return { label: `${days}d away`, color: '#059669', bg: '#D1FAE5' };
  };

  const shareOnWhatsApp = async (f) => {
    try {
      const res = await client.post('/marketing/whatsapp-text', { template: 'festival' });
      const text = res.data?.text || `${f.name} Special! Visit us for amazing festival deals.`;
      Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() => {});
    } catch {
      const text = `${f.name} is coming! Visit our shop for special deals. Don't miss out!`;
      Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() => {});
    }
  };

  const notifyFollowers = async (f) => {
    try {
      await client.post('/broadcast/send', {
        title: `${f.name} Special!`,
        message: `Get ready for ${f.name}! We have special deals and offers waiting for you. Visit now!`,
        segment: 'all',
      });
      toast.show({ type: 'success', text1: 'Notification sent to followers!' });
    } catch (err) {
      console.error('Notify followers error:', err);
      const errorMsg = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Failed to send notification';
      toast.show({ type: 'error', text1: 'Error', text2: String(errorMsg) });
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.navigate('/(business)/more')}>
          <Text style={s.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>🎪 Festival Calendar</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={COLORS.primary} />}
      >
        {loading ? (
          <View style={s.centerWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={s.loadingText}>Loading festival calendar...</Text>
          </View>
        ) : error ? (
          <View style={s.centerWrap}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>🎪</Text>
            <Text style={s.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadData} style={s.retryBtn}><Text style={s.retryText}>Retry</Text></TouchableOpacity>
          </View>
        ) : festivals.length === 0 ? (
          <View style={s.centerWrap}>
            <Text style={{ fontSize: 52, marginBottom: 12 }}>🎉</Text>
            <Text style={s.emptyTitle}>No upcoming festivals</Text>
            <Text style={s.emptySub}>Check back later for festival marketing opportunities</Text>
          </View>
        ) : (
          festivals.map((f, i) => {
            const urg = getUrgency(f);
            const hasProducts = f.suggested_products?.length > 0;
            const hasMissing = f.missing_categories?.length > 0;

            return (
              <View key={f.id || i} style={s.card}>
                {/* Header */}
                <View style={s.cardTop}>
                  <View style={s.festIcon}><Text style={{ fontSize: 28 }}>{f.emoji || '🎪'}</Text></View>
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

                {/* AI Suggestion */}
                {f.deal_suggestion && (
                  <View style={s.suggestionBox}>
                    <Text style={s.suggestionIcon}>🤖</Text>
                    <Text style={s.suggestionText}>{f.deal_suggestion}</Text>
                  </View>
                )}

                {/* Suggested products from your catalog */}
                {hasProducts && (
                  <View style={s.productsSection}>
                    <Text style={s.prodSectionTitle}>Your products for this festival:</Text>
                    {f.suggested_products.map((p, pi) => (
                      <View key={pi} style={s.prodRow}>
                        <Text style={s.prodName} numberOfLines={1}>{p.name}</Text>
                        <Text style={s.prodPrice}>{formatPrice(p.price)}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Missing categories */}
                {hasMissing && (
                  <View style={s.missingBox}>
                    <Text style={s.missingTitle}>💡 Opportunity:</Text>
                    <Text style={s.missingText}>
                      Add {f.missing_categories.join(', ')} products to your catalog for {f.name} sales
                    </Text>
                    <TouchableOpacity style={s.addProductBtn} onPress={() => router.push('/(business)/snap-list')}>
                      <Text style={s.addProductText}>+ Add Products</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Suggested categories */}
                {f.suggested_categories?.length > 0 && (
                  <View style={s.tagRow}>
                    {f.suggested_categories.map((cat, ci) => (
                      <View key={ci} style={s.tag}><Text style={s.tagText}>{cat}</Text></View>
                    ))}
                  </View>
                )}

                {/* Action buttons */}
                <View style={s.actRow}>
                  <TouchableOpacity onPress={() => router.push('/(business)/deals')} style={s.actBtn}>
                    <Text style={s.actBtnText}>🏷️ Create Deal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => shareOnWhatsApp(f)} style={[s.actBtn, { backgroundColor: '#25D366' }]}>
                    <Text style={[s.actBtnText, { color: '#fff' }]}>📱 WhatsApp</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => notifyFollowers(f)} style={[s.actBtn, { backgroundColor: COLORS.primary }]}>
                    <Text style={[s.actBtnText, { color: '#fff' }]}>🔔 Notify</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 20 }} />
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
  centerWrap: { alignItems: 'center', paddingTop: 60 },
  loadingText: { fontSize: 14, color: COLORS.gray400, marginTop: 12 },
  errorText: { fontSize: 15, color: COLORS.red, textAlign: 'center', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.primaryLight },
  retryText: { fontSize: 14, fontWeight: '600', color: COLORS.primary },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.gray700, marginBottom: 6 },
  emptySub: { fontSize: 14, color: COLORS.gray400, textAlign: 'center' },

  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 14, ...SHADOWS.card },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  festIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  festName: { fontSize: 17, fontWeight: '700', color: COLORS.gray900 },
  festDate: { fontSize: 13, color: COLORS.gray500, marginTop: 2 },
  urgBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  urgText: { fontSize: 11, fontWeight: '700' },
  festDesc: { fontSize: 13, color: COLORS.gray600, lineHeight: 19, marginBottom: 10 },

  suggestionBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EEF2FF', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#C7D2FE' },
  suggestionIcon: { fontSize: 16, marginTop: 1 },
  suggestionText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#4338CA', lineHeight: 18 },

  productsSection: { marginBottom: 10 },
  prodSectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.gray400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  prodRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  prodName: { fontSize: 13, color: COLORS.gray700, flex: 1, marginRight: 8 },
  prodPrice: { fontSize: 13, fontWeight: '700', color: COLORS.green },

  missingBox: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#FDE68A' },
  missingTitle: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  missingText: { fontSize: 13, color: '#92400E', lineHeight: 18, marginBottom: 8 },
  addProductBtn: { alignSelf: 'flex-start', backgroundColor: '#D97706', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  addProductText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  tag: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  tagText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  actRow: { flexDirection: 'row', gap: 8 },
  actBtn: { flex: 1, backgroundColor: COLORS.primaryLight, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  actBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
});
