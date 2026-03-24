import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useMyShop from '../../hooks/useMyShop';
import useLocationStore from '../../store/locationStore';
import { getShopStats, getProductAnalytics, getDemandInsights } from '../../lib/analytics';
import { getShopOrders } from '../../lib/orders';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';

const PERIODS = [
  { key: '7d', label: '7 Days' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
];

const STATUS_COLORS = {
  pending: '#EF9F27', confirmed: '#3B8BD4', preparing: '#7F77DD',
  ready: '#5DCAA5', completed: '#1D9E75', delivered: '#1D9E75', cancelled: '#E24B4A',
};

export default function AnalyticsScreen() {
  const { shopId } = useMyShop();
  const { lat, lng } = useLocationStore();
  const [period, setPeriod] = useState('7d');
  const [stats, setStats] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [demandInsights, setDemandInsights] = useState([]);
  const [orderBreakdown, setOrderBreakdown] = useState({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        getShopStats(shopId, period),
        getProductAnalytics(shopId),
        getDemandInsights(shopId, lat ?? 12.935, lng ?? 77.624),
        getShopOrders(shopId, { per_page: 100 }),
      ]);

      if (results[0].status === 'fulfilled') setStats(results[0].value?.data ?? null);
      if (results[1].status === 'fulfilled') {
        const d = results[1].value?.data;
        setTopProducts(Array.isArray(d) ? d : d?.items ?? []);
      }
      if (results[2].status === 'fulfilled') {
        const d = results[2].value?.data;
        setDemandInsights(Array.isArray(d) ? d : d?.items ?? []);
      }
      if (results[3].status === 'fulfilled') {
        const orders = results[3].value?.data;
        const list = Array.isArray(orders) ? orders : orders?.items ?? [];
        // Calculate order status breakdown
        const breakdown = {};
        list.forEach((o) => {
          const s = o.status || 'unknown';
          breakdown[s] = (breakdown[s] || 0) + 1;
        });
        setOrderBreakdown(breakdown);
      }
    } catch {
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [shopId, period, lat, lng]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const conversionRate = stats && Number(stats.total_views) > 0 && Number(stats.total_orders) >= 0
    ? ((Number(stats.total_orders) / Number(stats.total_views)) * 100).toFixed(1)
    : '0';

  if (loading && !stats) {
    return (
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}><Text style={styles.headerTitle}>Analytics</Text></View>
        <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Analytics</Text>
        </View>

        {/* Period Selector */}
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.key}
              style={[styles.periodPill, period === p.key && styles.periodPillActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Main Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderLeftColor: COLORS.green }]}>
            <Text style={styles.statIcon}>💰</Text>
            <Text style={styles.statValue}>{formatPrice(stats?.total_revenue ?? 0)}</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: COLORS.primary }]}>
            <Text style={styles.statIcon}>🛍️</Text>
            <Text style={styles.statValue}>{stats?.total_orders ?? 0}</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: COLORS.blue }]}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statValue}>{stats?.unique_visitors ?? 0}</Text>
            <Text style={styles.statLabel}>Visitors</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: COLORS.amber }]}>
            <Text style={styles.statIcon}>👁️</Text>
            <Text style={styles.statValue}>{stats?.total_views ?? 0}</Text>
            <Text style={styles.statLabel}>Views</Text>
          </View>
        </View>

        {/* Conversion Rate */}
        <View style={styles.conversionCard}>
          <View style={styles.conversionLeft}>
            <Text style={styles.conversionValue}>{conversionRate}%</Text>
            <Text style={styles.conversionLabel}>Conversion Rate</Text>
          </View>
          <Text style={styles.conversionDesc}>
            {stats?.total_orders ?? 0} orders from {stats?.total_views ?? 0} views
          </Text>
        </View>

        {/* Order Status Breakdown */}
        {Object.keys(orderBreakdown).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Order Breakdown</Text>
            <View style={styles.card}>
              {Object.entries(orderBreakdown).map(([status, count]) => {
                const total = Object.values(orderBreakdown).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <View key={status} style={styles.breakdownRow}>
                    <View style={[styles.breakdownDot, { backgroundColor: STATUS_COLORS[status] || COLORS.gray400 }]} />
                    <Text style={styles.breakdownLabel}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
                    <View style={styles.breakdownBarBg}>
                      <View style={[styles.breakdownBar, { width: `${pct}%`, backgroundColor: STATUS_COLORS[status] || COLORS.gray400 }]} />
                    </View>
                    <Text style={styles.breakdownCount}>{count}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Top Products */}
        <Text style={styles.sectionTitle}>Top Products</Text>
        {topProducts.length === 0 ? (
          <Text style={styles.emptyText}>No product data yet</Text>
        ) : (
          <View style={styles.card}>
            {topProducts.slice(0, 10).map((item, index) => (
              <View key={item.id || index} style={[styles.productRow, index === Math.min(topProducts.length, 10) - 1 && styles.lastRow]}>
                <View style={styles.rankBadge}><Text style={styles.rankText}>#{index + 1}</Text></View>
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.productMeta}>
                    {formatPrice(item.price)} · {item.view_count ?? 0} views · {item.wishlist_count ?? 0} wishlists
                  </Text>
                </View>
                <View style={[styles.availBadge, { backgroundColor: item.is_available ? '#E1F5EE' : COLORS.gray100 }]}>
                  <Text style={[styles.availText, { color: item.is_available ? COLORS.green : COLORS.gray500 }]}>
                    {item.is_available ? 'Live' : 'Off'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Demand Insights */}
        <Text style={styles.sectionTitle}>Demand Insights</Text>
        <Text style={styles.sectionSub}>Top searches near your shop</Text>
        {demandInsights.length === 0 ? (
          <Text style={styles.emptyText}>No search data nearby yet</Text>
        ) : (
          <View style={styles.tagsWrap}>
            {demandInsights.map((term, index) => (
              <View key={index} style={styles.demandTag}>
                <Text style={styles.demandTagText}>
                  {typeof term === 'string' ? term : term.query || term.term}
                </Text>
                {term.count != null && (
                  <View style={styles.demandCount}>
                    <Text style={styles.demandCountText}>{term.count}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.gray900 },

  periodRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16 },
  periodPill: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.white, borderWidth: 1, borderColor: COLORS.gray200, marginRight: 10,
  },
  periodPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  periodText: { fontSize: 13, fontWeight: '600', color: COLORS.gray600 },
  periodTextActive: { color: COLORS.white, fontWeight: '700' },

  errorCard: { backgroundColor: '#FCEBEB', borderRadius: 12, padding: 12, marginHorizontal: 16, marginBottom: 12 },
  errorText: { color: COLORS.red, fontSize: 13, fontWeight: '600' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, justifyContent: 'space-between' },
  statCard: {
    width: '48%', backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    borderLeftWidth: 4, marginBottom: 10, ...SHADOWS.card,
  },
  statIcon: { fontSize: 18, marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: '800', color: COLORS.gray900 },
  statLabel: { fontSize: 12, color: COLORS.gray500, fontWeight: '500', marginTop: 2 },

  conversionCard: {
    backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginHorizontal: 16,
    marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    ...SHADOWS.card,
  },
  conversionLeft: { alignItems: 'flex-start' },
  conversionValue: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  conversionLabel: { fontSize: 12, color: COLORS.gray500, fontWeight: '500' },
  conversionDesc: { fontSize: 12, color: COLORS.gray400, textAlign: 'right', flex: 1, marginLeft: 12 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray800, marginHorizontal: 16, marginTop: 16, marginBottom: 4 },
  sectionSub: { fontSize: 12, color: COLORS.gray500, marginHorizontal: 16, marginBottom: 10 },
  emptyText: { fontSize: 14, color: COLORS.gray400, paddingHorizontal: 16, paddingVertical: 12 },

  card: { backgroundColor: COLORS.white, borderRadius: 14, marginHorizontal: 16, overflow: 'hidden', ...SHADOWS.card },

  // Order breakdown
  breakdownRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  breakdownDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  breakdownLabel: { fontSize: 13, fontWeight: '500', color: COLORS.gray700, width: 80, textTransform: 'capitalize' },
  breakdownBarBg: { flex: 1, height: 6, backgroundColor: COLORS.gray100, borderRadius: 3, marginHorizontal: 8 },
  breakdownBar: { height: 6, borderRadius: 3 },
  breakdownCount: { fontSize: 14, fontWeight: '700', color: COLORS.gray900, width: 30, textAlign: 'right' },

  // Products
  productRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray100,
  },
  lastRow: { borderBottomWidth: 0 },
  rankBadge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  rankText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '600', color: COLORS.gray800 },
  productMeta: { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  availBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  availText: { fontSize: 11, fontWeight: '700' },

  // Demand tags
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginTop: 4 },
  demandTag: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#E6F1FB',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8, marginBottom: 8,
  },
  demandTagText: { fontSize: 13, fontWeight: '600', color: COLORS.blue },
  demandCount: { backgroundColor: COLORS.blue, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, marginLeft: 6 },
  demandCountText: { fontSize: 10, fontWeight: '700', color: COLORS.white },
});
