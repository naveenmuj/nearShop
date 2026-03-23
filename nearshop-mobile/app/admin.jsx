import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity, StatusBar, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import client from '../lib/api';
import { COLORS, SHADOWS, formatPrice } from '../constants/theme';

function StatCard({ label, value, icon, color }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [overview, setOverview] = useState(null);
  const [shops, setShops] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [funnel, setFunnel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Handle Android back button
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => handler.remove();
  }, [router]);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const results = await Promise.allSettled([
        client.get('/admin/overview'),
        client.get('/admin/shops/leaderboard', { params: { limit: 5 } }),
        client.get('/admin/products/top-viewed', { params: { limit: 5 } }),
        client.get('/admin/users/recent', { params: { limit: 8 } }),
        client.get('/admin/orders/funnel'),
      ]);

      if (results[0].status === 'fulfilled') setOverview(results[0].value.data);
      else setError(results[0].reason?.response?.data?.detail || 'Failed to load');

      if (results[1].status === 'fulfilled') {
        const d = results[1].value.data;
        setShops(Array.isArray(d) ? d : d?.items ?? []);
      }
      if (results[2].status === 'fulfilled') {
        const d = results[2].value.data;
        setProducts(Array.isArray(d) ? d : d?.items ?? []);
      }
      if (results[3].status === 'fulfilled') {
        const d = results[3].value.data;
        setUsers(Array.isArray(d) ? d : d?.items ?? []);
      }
      if (results[4].status === 'fulfilled') setFunnel(results[4].value.data);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load admin data');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const goBack = () => router.back();

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={goBack}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
          <Text style={styles.headerBarTitle}>Admin Dashboard</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={goBack}><Text style={styles.backText}>← Back</Text></TouchableOpacity>
        <Text style={styles.headerBarTitle}>Admin Dashboard</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.scrollContent}
      >
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{String(error)}</Text>
            <TouchableOpacity onPress={onRefresh}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>
          </View>
        )}

        {/* Overview Stats */}
        {overview && (
          <>
            <Text style={styles.sectionTitle}>Platform Overview</Text>
            <View style={styles.statsGrid}>
              <StatCard label="Users" value={overview.total_users ?? 0} icon="👥" color={COLORS.blue} />
              <StatCard label="Shops" value={overview.total_shops ?? 0} icon="🏪" color={COLORS.green} />
              <StatCard label="Products" value={overview.total_products ?? 0} icon="📦" color={COLORS.primary} />
              <StatCard label="Orders" value={overview.total_orders ?? 0} icon="🛒" color={COLORS.amber} />
              <StatCard label="Revenue" value={formatPrice(overview.gmv_total ?? 0)} icon="💰" color="#1D9E75" />
              <StatCard label="Rating" value={overview.avg_platform_rating ?? 0} icon="⭐" color="#EF9F27" />
            </View>

            {/* Key Metrics */}
            <Text style={styles.sectionTitle}>This Week</Text>
            <View style={styles.metricsCard}>
              {[
                ['New Users', overview.new_users_7d ?? 0],
                ['New Shops', overview.new_shops_7d ?? 0],
                ['Orders', overview.orders_7d ?? 0],
                ['Revenue', formatPrice(overview.gmv_7d ?? 0)],
                ['Avg Order', formatPrice(overview.avg_order_value ?? 0)],
                ['Cancel Rate', `${overview.cancellation_rate ?? 0}%`],
                ['Active Deals', overview.active_deals ?? 0],
                ['Reviews', overview.total_reviews ?? 0],
                ['Haggles', overview.total_haggles ?? 0],
              ].map(([label, val]) => (
                <View key={label} style={styles.metricRow}>
                  <Text style={styles.metricLabel}>{label}</Text>
                  <Text style={styles.metricValue}>{val}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Order Funnel */}
        {funnel && typeof funnel === 'object' && (
          <>
            <Text style={styles.sectionTitle}>Order Funnel</Text>
            <View style={styles.card}>
              {Object.entries(funnel).map(([status, count]) => (
                <View key={status} style={styles.funnelRow}>
                  <View style={[styles.funnelDot, { backgroundColor: STATUS_COLOR[status] || COLORS.gray400 }]} />
                  <Text style={styles.funnelLabel}>{status}</Text>
                  <Text style={styles.funnelCount}>{count}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Top Shops */}
        {shops.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top Shops</Text>
            <View style={styles.card}>
              {shops.map((s, i) => (
                <View key={s.id || i} style={[styles.listRow, i === shops.length - 1 && styles.listRowLast]}>
                  <View style={styles.rankBadge}><Text style={styles.rankText}>{i + 1}</Text></View>
                  <View style={styles.listInfo}>
                    <Text style={styles.listName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.listSub}>{s.category} · {s.products ?? 0} products</Text>
                  </View>
                  <Text style={styles.scoreText}>{Number(s.score ?? 0).toFixed(1)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Top Products */}
        {products.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Most Viewed</Text>
            <View style={styles.card}>
              {products.map((p, i) => (
                <View key={p.id || i} style={[styles.listRow, i === products.length - 1 && styles.listRowLast]}>
                  <View style={[styles.rankBadge, { backgroundColor: COLORS.primaryLight }]}>
                    <Text style={[styles.rankText, { color: COLORS.primary }]}>{i + 1}</Text>
                  </View>
                  <View style={styles.listInfo}>
                    <Text style={styles.listName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.listSub}>{formatPrice(p.price)} · {p.view_count ?? 0} views</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Recent Users */}
        {users.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent Users</Text>
            <View style={styles.card}>
              {users.map((u, i) => (
                <View key={u.id || i} style={[styles.listRow, i === users.length - 1 && styles.listRowLast]}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{(u.name || '?')[0].toUpperCase()}</Text></View>
                  <View style={styles.listInfo}>
                    <Text style={styles.listName} numberOfLines={1}>{u.name || u.phone || 'User'}</Text>
                    <Text style={styles.listSub}>{u.active_role || 'customer'} · {u.phone || u.email || ''}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const STATUS_COLOR = {
  pending: '#EF9F27', confirmed: '#3B8BD4', preparing: '#7F77DD',
  ready: '#5DCAA5', completed: '#1D9E75', delivered: '#1D9E75', cancelled: '#E24B4A',
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },

  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.gray100,
  },
  backText: { fontSize: 15, fontWeight: '600', color: COLORS.primary },
  headerBarTitle: { fontSize: 17, fontWeight: '700', color: COLORS.gray900 },

  errorBanner: {
    backgroundColor: '#FCEBEB', padding: 14, borderRadius: 12, marginTop: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  errorText: { color: COLORS.red, fontWeight: '600', fontSize: 13, flex: 1 },
  retryText: { color: COLORS.white, fontWeight: '700', fontSize: 12, backgroundColor: COLORS.red, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, overflow: 'hidden', marginLeft: 8 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray900, marginTop: 20, marginBottom: 10 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: {
    width: '48%', backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    borderLeftWidth: 4, marginBottom: 10, ...SHADOWS.card,
  },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, color: COLORS.gray500, fontWeight: '500', marginTop: 2 },

  metricsCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, ...SHADOWS.card },
  metricRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray100,
  },
  metricLabel: { fontSize: 14, color: COLORS.gray600 },
  metricValue: { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },

  card: { backgroundColor: COLORS.white, borderRadius: 14, overflow: 'hidden', ...SHADOWS.card },
  funnelRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  funnelDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  funnelLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.gray700, textTransform: 'capitalize' },
  funnelCount: { fontSize: 16, fontWeight: '700', color: COLORS.gray900 },

  listRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray100,
  },
  listRowLast: { borderBottomWidth: 0 },
  rankBadge: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#FAEEDA',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  rankText: { fontSize: 13, fontWeight: '800', color: COLORS.amber },
  listInfo: { flex: 1 },
  listName: { fontSize: 14, fontWeight: '600', color: COLORS.gray900 },
  listSub: { fontSize: 12, color: COLORS.gray400, marginTop: 2 },
  scoreText: { fontSize: 16, fontWeight: '800', color: COLORS.green },

  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
