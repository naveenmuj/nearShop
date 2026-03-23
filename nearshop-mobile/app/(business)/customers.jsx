import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, StatusBar, BackHandler, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import client from '../../lib/api';
import useMyShop from '../../hooks/useMyShop';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

export default function CustomersScreen() {
  const { shopId } = useMyShop();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => { const h = BackHandler.addEventListener('hardwareBackPress', () => { router.navigate('/(business)/more'); return true; }); return () => h.remove(); }, []);

  const loadData = useCallback(async () => {
    if (!shopId) return;
    setLoading(true); setError(null);
    try {
      const [oRes] = await Promise.allSettled([
        client.get(`/orders/shop/${shopId}`, { params: { per_page: 500 } }),
      ]);
      if (oRes.status === 'fulfilled') {
        const orders = oRes.value.data?.orders ?? oRes.value.data?.items ?? oRes.value.data ?? [];
        const map = {};
        orders.forEach(o => {
          const key = o.customer_phone || o.customer_id || o.customer_name || 'unknown';
          if (!map[key]) map[key] = { name: o.customer_name || 'Unknown', phone: o.customer_phone || '', orders: 0, total: 0, lastOrder: o.created_at };
          map[key].orders += 1;
          map[key].total += Number(o.total) || 0;
          if (o.created_at > map[key].lastOrder) map[key].lastOrder = o.created_at;
        });
        const list = Object.values(map).sort((a, b) => b.total - a.total);
        setCustomers(list);
      } else { setError('Failed to load customer data'); }
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  }, [shopId]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = search
    ? customers.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search))
    : customers;

  const callCustomer = (phone) => {
    if (phone) Linking.openURL(`tel:${phone}`).catch(() => {});
  };

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
            <View style={s.statsRow}>
              <View style={s.statCard}><Text style={s.statVal}>{customers.length}</Text><Text style={s.statLabel}>Total Customers</Text></View>
              <View style={s.statCard}><Text style={s.statVal}>{formatPrice(customers.reduce((s, c) => s + c.total, 0))}</Text><Text style={s.statLabel}>Total Revenue</Text></View>
            </View>

            {filtered.length === 0 && <Text style={s.empty}>No customers found</Text>}
            {filtered.map((c, i) => (
              <View key={i} style={s.card}>
                <View style={s.cardRow}>
                  <View style={s.avatar}><Text style={s.avatarText}>{(c.name || '?').charAt(0).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.custName}>{c.name}</Text>
                    <Text style={s.custSub}>{c.orders} order{c.orders !== 1 ? 's' : ''} | {formatPrice(c.total)} spent</Text>
                    {c.lastOrder && <Text style={s.custDate}>Last: {new Date(c.lastOrder).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>}
                  </View>
                  {c.phone ? (
                    <TouchableOpacity onPress={() => callCustomer(c.phone)} style={s.phoneBtn}>
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
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 12, padding: 14, ...SHADOWS.card },
  statVal: { fontSize: 18, fontWeight: '800', color: COLORS.gray900 },
  statLabel: { fontSize: 11, color: COLORS.gray400, marginTop: 2 },
  card: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginBottom: 10, ...SHADOWS.card },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  custName: { fontSize: 14, fontWeight: '600', color: COLORS.gray800 },
  custSub: { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  custDate: { fontSize: 11, color: COLORS.gray400, marginTop: 1 },
  phoneBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.greenLight, alignItems: 'center', justifyContent: 'center' },
  phoneIcon: { fontSize: 18 },
});
