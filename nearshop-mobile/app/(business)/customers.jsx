import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, BackHandler, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { getCustomerSegments } from '../../lib/api/ai';
import useMyShop from '../../hooks/useMyShop';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const SEGMENT_ICONS = { 'Champions': '🏆', 'Loyal': '💎', 'Potential Loyalist': '🌟', 'At Risk': '⚠️', "Can't Lose": '🚨', 'Lost': '👻', 'New Customers': '🆕', 'Others': '👤' };
const SEGMENT_COLORS = { 'Champions': '#10B981', 'Loyal': '#3B82F6', 'At Risk': '#F59E0B', "Can't Lose": '#EF4444', 'Lost': '#6B7280', 'New Customers': '#06B6D4', 'Potential Loyalist': '#8B5CF6' };

export default function CustomersScreen() {
  const { shopId } = useMyShop();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [segments, setSegments] = useState(null);
  const [segFilter, setSegFilter] = useState('all');

  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { router.navigate('/(business)/more'); return true; }); return () => h.remove(); }, []);

  const loadData = useCallback(async () => {
    if (!shopId) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      // Get customer segments which includes all customer data
      const segRes = await getCustomerSegments(shopId);
      const data = segRes.data;
      
      if (data) {
        setSegments(data);
        // The customers array from segments already has all the data we need
        setCustomers(data.customers || []);
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
      setError(err?.response?.data?.detail || 'Failed to load customer data');
    } finally { setLoading(false); }
  }, [shopId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = customers.filter(c => {
    const matchSearch = !search || 
      c.name?.toLowerCase().includes(search.toLowerCase()) || 
      c.phone?.includes(search);
    const matchSeg = segFilter === 'all' || c.segment === segFilter;
    return matchSearch && matchSeg;
  });

  const segList = segments?.segments ? Object.entries(segments.segments).sort((a, b) => b[1] - a[1]) : [];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.navigate('/(business)/more')}><Text style={s.back}>← Back</Text></TouchableOpacity>
        <Text style={s.title}>Customers</Text>
        <View style={{ width: 50 }} />
      </View>

      <View style={s.searchWrap}>
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Search customers..." placeholderTextColor={COLORS.gray400} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} /> :
         error ? <Text style={s.empty}>{error}</Text> : null}

        {!loading && !error && (
          <>
            {/* RFM Summary Cards */}
            {segments?.summary && (
              <View style={s.statsRow}>
                <View style={[s.statCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1 }]}>
                  <Text style={{ fontSize: 20 }}>🏆</Text>
                  <Text style={[s.statVal, { color: '#059669' }]}>{segments.summary.champions_count}</Text>
                  <Text style={[s.statLabel, { color: '#059669' }]}>Champions</Text>
                </View>
                <View style={[s.statCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1 }]}>
                  <Text style={{ fontSize: 20 }}>⚠️</Text>
                  <Text style={[s.statVal, { color: '#D97706' }]}>{segments.summary.at_risk_count}</Text>
                  <Text style={[s.statLabel, { color: '#D97706' }]}>At Risk</Text>
                </View>
                <View style={[s.statCard, { backgroundColor: COLORS.white }]}>
                  <Text style={{ fontSize: 20 }}>👥</Text>
                  <Text style={s.statVal}>{segments.summary.total}</Text>
                  <Text style={s.statLabel}>Total</Text>
                </View>
              </View>
            )}

            {/* Segment filter pills */}
            {segList.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <TouchableOpacity onPress={() => setSegFilter('all')} style={[s.pill, segFilter === 'all' && s.pillActive]}>
                  <Text style={[s.pillText, segFilter === 'all' && s.pillTextActive]}>All</Text>
                </TouchableOpacity>
                {segList.map(([seg, count]) => (
                  <TouchableOpacity key={seg} onPress={() => setSegFilter(seg)} style={[s.pill, segFilter === seg && s.pillActive]}>
                    <Text style={[s.pillText, segFilter === seg && s.pillTextActive]}>{SEGMENT_ICONS[seg]} {seg} ({count})</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {filtered.length === 0 && <Text style={s.empty}>No customers found</Text>}
            {Array.isArray(filtered) && filtered.map((c, i) => (
              <View key={c.customer_id || i} style={s.card}>
                <View style={s.cardRow}>
                  <View style={[s.avatar, { backgroundColor: (SEGMENT_COLORS[c.segment] || COLORS.primaryLight) + '30' }]}>
                    <Text style={[s.avatarText, { color: SEGMENT_COLORS[c.segment] || COLORS.primary }]}>{(c.name || '?').charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={s.custName}>{c.name}</Text>
                      {c.segment && (
                        <View style={[s.segBadge, { backgroundColor: (SEGMENT_COLORS[c.segment] || '#9CA3AF') + '20' }]}>
                          <Text style={[s.segBadgeText, { color: SEGMENT_COLORS[c.segment] || '#9CA3AF' }]}>{SEGMENT_ICONS[c.segment]} {c.segment}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.custSub}>{c.frequency} order{c.frequency !== 1 ? 's' : ''} | {formatPrice(c.monetary)} spent</Text>
                    {c.win_back_action && (c.segment === 'At Risk' || c.segment === "Can't Lose" || c.segment === 'Lost') && (
                      <Text style={s.winBack}>💡 {c.win_back_action}</Text>
                    )}
                  </View>
                  {c.phone ? (
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${c.phone}`).catch(() => {})} style={s.phoneBtn}>
                      <Text style={s.phoneIcon}>{'📞'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))}
          </>
        )}
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
  searchWrap: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  searchInput: { backgroundColor: COLORS.gray50, borderRadius: 10, borderWidth: 1, borderColor: COLORS.gray200, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.gray900 },
  empty: { textAlign: 'center', color: COLORS.gray400, marginTop: 40 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 12, alignItems: 'center', ...SHADOWS.card },
  statVal: { fontSize: 18, fontWeight: '800', color: COLORS.gray900, marginTop: 2 },
  statLabel: { fontSize: 10, color: COLORS.gray400, marginTop: 2, fontWeight: '600' },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10, ...SHADOWS.card },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700' },
  custName: { fontSize: 14, fontWeight: '600', color: COLORS.gray800 },
  custSub: { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  winBack: { fontSize: 10, color: '#D97706', marginTop: 3 },
  phoneBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.greenLight, alignItems: 'center', justifyContent: 'center' },
  phoneIcon: { fontSize: 18 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: COLORS.gray100, marginRight: 6 },
  pillActive: { backgroundColor: COLORS.primary },
  pillText: { fontSize: 12, fontWeight: '600', color: COLORS.gray500 },
  pillTextActive: { color: COLORS.white },
  segBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  segBadgeText: { fontSize: 9, fontWeight: '700' },
});
