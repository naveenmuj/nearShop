import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity, StatusBar,
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

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [overview, setOverview] = useState(null);
  const [shopLeaderboard, setShopLeaderboard] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [orderFunnel, setOrderFunnel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

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

      const [overviewRes, shopsRes, productsRes, usersRes, funnelRes] = results;

      if (overviewRes.status === 'fulfilled') {
        setOverview(overviewRes.value.data);
      } else {
        const msg = overviewRes.reason?.response?.data?.detail || overviewRes.reason?.message;
        setError(msg || 'Failed to load admin data');
      }

      if (shopsRes.status === 'fulfilled') {
        const d = shopsRes.value.data;
        setShopLeaderboard(Array.isArray(d) ? d : d?.shops ?? d?.items ?? []);
      }
      if (productsRes.status === 'fulfilled') {
        const d = productsRes.value.data;
        setTopProducts(Array.isArray(d) ? d : d?.products ?? d?.items ?? []);
      }
      if (usersRes.status === 'fulfilled') {
        const d = usersRes.value.data;
        setRecentUsers(Array.isArray(d) ? d : d?.users ?? d?.items ?? []);
      }
      if (funnelRes.status === 'fulfilled') {
        setOrderFunnel(funnelRes.value.data);
      }
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#4338CA" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
        </View>
        <View style={[styles.center, { backgroundColor: COLORS.bg }]}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading admin data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#4338CA" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.white} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSub}>Platform Overview</Text>
        </View>

        <View style={styles.body}>
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retrySmallBtn} onPress={onRefresh}>
                <Text style={styles.retrySmallText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Overview stats */}
          {overview && (
            <View style={styles.statsGrid}>
              <StatCard label="Total Users" value={overview.total_users ?? 0} icon="👥" color={COLORS.blue} />
              <StatCard label="Total Shops" value={overview.total_shops ?? 0} icon="🏪" color={COLORS.green} />
              <StatCard label="Products" value={overview.total_products ?? 0} icon="📦" color={COLORS.primary} />
              <StatCard label="Orders" value={overview.total_orders ?? 0} icon="🛒" color={COLORS.amber} />
              <StatCard label="Revenue" value={formatPrice(overview.gmv_total ?? 0)} icon="💰" color="#1D9E75" />
              <StatCard label="Avg Rating" value={overview.avg_platform_rating ?? 0} icon="⭐" color="#EF9F27" />
            </View>
          )}

          {/* Key metrics */}
          {overview && (
            <Section title="Key Metrics">
              <View style={styles.metricsCard}>
                {[
                  { label: 'New users (7d)', value: overview.new_users_7d ?? 0 },
                  { label: 'New shops (7d)', value: overview.new_shops_7d ?? 0 },
                  { label: 'Orders (7d)', value: overview.orders_7d ?? 0 },
                  { label: 'Revenue (7d)', value: formatPrice(overview.gmv_7d ?? 0) },
                  { label: 'Avg order value', value: formatPrice(overview.avg_order_value ?? 0) },
                  { label: 'Cancel rate', value: `${overview.cancellation_rate ?? 0}%` },
                  { label: 'Active deals', value: overview.active_deals ?? 0 },
                  { label: 'Total reviews', value: overview.total_reviews ?? 0 },
                  { label: 'Haggles', value: overview.total_haggles ?? 0 },
                  { label: 'ShopCoins in circ.', value: overview.shopcoins_circulation ?? 0 },
                ].map(({ label, value }) => (
                  <View key={label} style={styles.metricRow}>
                    <Text style={styles.metricLabel}>{label}</Text>
                    <Text style={styles.metricValue}>{value}</Text>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* Order funnel */}
          {orderFunnel && typeof orderFunnel === 'object' && (
            <Section title="Order Funnel">
              <View style={styles.funnelCard}>
                {Object.entries(orderFunnel).map(([status, count]) => (
                  <View key={status} style={styles.funnelRow}>
                    <View style={[styles.funnelDot, { backgroundColor: STATUS_COLOR[status] || COLORS.gray400 }]} />
                    <Text style={styles.funnelLabel}>{status}</Text>
                    <Text style={styles.funnelCount}>{count}</Text>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* Top shops */}
          {shopLeaderboard.length > 0 && (
            <Section title="Top Shops">
              <View style={styles.listCard}>
                {shopLeaderboard.map((shop, idx) => (
                  <View key={shop.id || idx} style={[styles.listRow, idx === shopLeaderboard.length - 1 && styles.listRowLast]}>
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>{idx + 1}</Text>
                    </View>
                    <View style={styles.listInfo}>
                      <Text style={styles.listName} numberOfLines={1}>{shop.name}</Text>
                      <Text style={styles.listSub}>{shop.category || 'N/A'} · {shop.products ?? shop.total_products ?? 0} products</Text>
                    </View>
                    <View style={styles.listRight}>
                      <Text style={styles.listScore}>{Number(shop.score ?? shop.avg_rating ?? 0).toFixed(1)}</Text>
                      <Text style={styles.listScoreLabel}>score</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* Top products */}
          {topProducts.length > 0 && (
            <Section title="Most Viewed Products">
              <View style={styles.listCard}>
                {topProducts.map((p, idx) => (
                  <View key={p.id || idx} style={[styles.listRow, idx === topProducts.length - 1 && styles.listRowLast]}>
                    <View style={[styles.rankBadge, { backgroundColor: COLORS.primaryLight }]}>
                      <Text style={[styles.rankText, { color: COLORS.primary }]}>{idx + 1}</Text>
                    </View>
                    <View style={styles.listInfo}>
                      <Text style={styles.listName} numberOfLines={1}>{p.name}</Text>
                      <Text style={styles.listSub}>{formatPrice(p.price)} · {p.view_count ?? p.views ?? 0} views</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* Recent users */}
          {recentUsers.length > 0 && (
            <Section title="Recent Users">
              <View style={styles.listCard}>
                {recentUsers.map((u, idx) => (
                  <View key={u.id || idx} style={[styles.listRow, idx === recentUsers.length - 1 && styles.listRowLast]}>
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>{(u.name || '?')[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.listInfo}>
                      <Text style={styles.listName} numberOfLines={1}>{u.name || u.email || u.phone || 'User'}</Text>
                      <Text style={styles.listSub}>{u.active_role || u.role || 'customer'} · {u.phone || u.email || ''}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* Empty state when no data at all */}
          {!overview && !error && (
            <View style={styles.center}>
              <Text style={{ fontSize: 48 }}>📊</Text>
              <Text style={styles.loadingText}>No admin data available</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const STATUS_COLOR = {
  pending: '#EF9F27', confirmed: '#3B8BD4', preparing: '#7F77DD',
  ready: '#5DCAA5', completed: '#1D9E75', delivered: '#1D9E75', cancelled: '#E24B4A',
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#4338CA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 60 },
  loadingText: { color: COLORS.gray400, fontSize: 14 },
  body: { backgroundColor: COLORS.bg, minHeight: 500 },

  header: { backgroundColor: '#4338CA', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  backBtn: { marginBottom: 12 },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  errorBanner: {
    backgroundColor: COLORS.redLight, padding: 14, marginHorizontal: 16, marginTop: 16,
    borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  errorText: { color: COLORS.red, fontWeight: '600', fontSize: 13, flex: 1 },
  retrySmallBtn: { backgroundColor: COLORS.red, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginLeft: 8 },
  retrySmallText: { color: COLORS.white, fontWeight: '700', fontSize: 12 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 16, gap: 10 },
  statCard: {
    width: '47%', backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    borderLeftWidth: 4, ...SHADOWS.card,
  },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, color: COLORS.gray500, fontWeight: '500', marginTop: 2 },

  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray900, marginBottom: 10 },

  metricsCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, ...SHADOWS.card },
  metricRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray100,
  },
  metricLabel: { fontSize: 14, color: COLORS.gray600 },
  metricValue: { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },

  funnelCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, ...SHADOWS.card },
  funnelRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  funnelDot: { width: 10, height: 10, borderRadius: 5 },
  funnelLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.gray700, textTransform: 'capitalize' },
  funnelCount: { fontSize: 16, fontWeight: '700', color: COLORS.gray900 },

  listCard: { backgroundColor: COLORS.white, borderRadius: 14, overflow: 'hidden', ...SHADOWS.card },
  listRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray100,
  },
  listRowLast: { borderBottomWidth: 0 },
  rankBadge: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: COLORS.amberLight,
    justifyContent: 'center', alignItems: 'center',
  },
  rankText: { fontSize: 13, fontWeight: '800', color: COLORS.amber },
  listInfo: { flex: 1 },
  listName: { fontSize: 14, fontWeight: '600', color: COLORS.gray900 },
  listSub: { fontSize: 12, color: COLORS.gray400, marginTop: 2 },
  listRight: { alignItems: 'center' },
  listScore: { fontSize: 16, fontWeight: '800', color: COLORS.green },
  listScoreLabel: { fontSize: 10, color: COLORS.gray400 },

  userAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  userAvatarText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
