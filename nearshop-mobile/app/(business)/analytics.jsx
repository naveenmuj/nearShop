import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useMyShop from '../../hooks/useMyShop';
import useLocationStore from '../../store/locationStore';
import { getShopStats, getProductAnalytics, getDemandInsights, getPhase1Insights } from '../../lib/analytics';
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
  const router = useRouter();
  const { shopId } = useMyShop();
  const { lat, lng } = useLocationStore();
  const [period, setPeriod] = useState('7d');
  const [stats, setStats] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [demandInsights, setDemandInsights] = useState([]);
  const [phase1, setPhase1] = useState(null);
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
        getPhase1Insights(shopId, lat ?? 12.935, lng ?? 77.624),
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
      if (results[3].status === 'fulfilled') setPhase1(results[3].value?.data ?? null);
      if (results[4].status === 'fulfilled') {
        const orders = results[4].value?.data;
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
  const forecast = phase1?.sales_forecast;
  const reorderAlerts = phase1?.reorder_alerts ?? [];
  const segmentSummary = phase1?.customer_segments?.summary;
  const segmentBreakdown = phase1?.customer_segments?.segments
    ? Object.entries(phase1.customer_segments.segments).sort((a, b) => b[1] - a[1])
    : [];
  const recommendedActions = phase1?.recommended_actions ?? [];
  const actionRouteMap = {
    analytics: '/(business)/analytics',
    inventory: '/(business)/inventory',
    marketing: '/(business)/marketing',
    deals: '/(business)/deals',
    customers: '/(business)/customers',
  };

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

        {forecast && (
          <View style={styles.forecastRow}>
            <View style={[styles.forecastCard, { borderLeftColor: COLORS.green }]}>
              <Text style={styles.forecastLabel}>7-Day Revenue Forecast</Text>
              <Text style={[styles.forecastValue, { color: COLORS.green }]}>{formatPrice(forecast.next_7_days_revenue)}</Text>
              <Text style={styles.forecastMeta}>
                Avg/day {formatPrice(forecast.recent_daily_avg_revenue)}
                {forecast.revenue_trend_pct != null ? ` · ${forecast.revenue_trend_pct >= 0 ? '+' : ''}${forecast.revenue_trend_pct}%` : ''}
              </Text>
            </View>
            <View style={[styles.forecastCard, { borderLeftColor: COLORS.primary }]}>
              <Text style={styles.forecastLabel}>7-Day Orders Forecast</Text>
              <Text style={[styles.forecastValue, { color: COLORS.primary }]}>{forecast.next_7_days_orders}</Text>
              <Text style={styles.forecastMeta}>
                Avg/day {Number(forecast.recent_daily_avg_orders ?? 0).toFixed(1)}
                {forecast.orders_trend_pct != null ? ` · ${forecast.orders_trend_pct >= 0 ? '+' : ''}${forecast.orders_trend_pct}%` : ''}
              </Text>
            </View>
          </View>
        )}

        {(segmentSummary || segmentBreakdown.length > 0) && (
          <>
            <Text style={styles.sectionTitle}>Customer Segments</Text>
            <View style={styles.card}>
              <View style={styles.segmentSummaryRow}>
                <View style={[styles.segmentSummaryCard, { backgroundColor: '#E8F8F1' }]}>
                  <Text style={[styles.segmentSummaryLabel, { color: COLORS.green }]}>Champions</Text>
                  <Text style={[styles.segmentSummaryValue, { color: COLORS.green }]}>{segmentSummary?.champions_count ?? 0}</Text>
                </View>
                <View style={[styles.segmentSummaryCard, { backgroundColor: '#FEF3E2' }]}>
                  <Text style={[styles.segmentSummaryLabel, { color: COLORS.amber }]}>At Risk</Text>
                  <Text style={[styles.segmentSummaryValue, { color: COLORS.amber }]}>{segmentSummary?.at_risk_count ?? 0}</Text>
                </View>
                <View style={[styles.segmentSummaryCard, { backgroundColor: COLORS.gray100 }]}>
                  <Text style={styles.segmentSummaryLabel}>Total</Text>
                  <Text style={styles.segmentSummaryValue}>{segmentSummary?.total ?? 0}</Text>
                </View>
              </View>
              {segmentBreakdown.slice(0, 5).map(([name, count], index) => (
                <View key={name} style={[styles.segmentRow, index === Math.min(segmentBreakdown.length, 5) - 1 && styles.lastRow]}>
                  <Text style={styles.segmentName}>{name}</Text>
                  <Text style={styles.segmentCount}>{count}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Recommended Actions</Text>
        <View style={styles.actionsWrap}>
          {recommendedActions.map((action) => (
            <View key={action.id} style={styles.actionCard}>
              <View style={styles.actionHeader}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.actionTitle}>{action.title}</Text>
                  <Text style={styles.actionDescription}>{action.description}</Text>
                </View>
                <View style={[
                  styles.actionPriorityBadge,
                  action.priority === 'high'
                    ? styles.actionPriorityHigh
                    : action.priority === 'medium'
                      ? styles.actionPriorityMedium
                      : styles.actionPriorityLow,
                ]}>
                  <Text style={[
                    styles.actionPriorityText,
                    action.priority === 'high'
                      ? styles.actionPriorityTextHigh
                      : action.priority === 'medium'
                        ? styles.actionPriorityTextMedium
                        : styles.actionPriorityTextLow,
                  ]}>
                    {action.priority}
                  </Text>
                </View>
              </View>
              {Array.isArray(action.highlights) && action.highlights.length > 0 && (
                <View style={styles.actionHighlights}>
                  {action.highlights.map((item) => (
                    <Text key={item} style={styles.actionHighlight}>• {item}</Text>
                  ))}
                </View>
              )}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => action.target && actionRouteMap[action.target] && router.push(actionRouteMap[action.target])}
              >
                <Text style={styles.actionButtonText}>{action.cta_label || 'Open'}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Reorder Alerts</Text>
        {reorderAlerts.length === 0 ? (
          <Text style={styles.emptyText}>No urgent stock issues detected</Text>
        ) : (
          <View style={styles.card}>
            {reorderAlerts.map((item, index) => (
              <View key={item.product_id || index} style={[styles.alertRow, index === reorderAlerts.length - 1 && styles.lastRow]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle} numberOfLines={1}>{item.product_name}</Text>
                  <Text style={styles.alertMeta}>
                    Stock {item.stock_quantity} · velocity {item.daily_sales_velocity}/day
                    {item.days_left != null ? ` · ${item.days_left} days left` : ''}
                  </Text>
                  <Text style={styles.alertHint}>
                    Reorder {item.recommended_reorder_qty}
                    {item.estimated_revenue_at_risk > 0 ? ` · At risk ${formatPrice(item.estimated_revenue_at_risk)}` : ''}
                  </Text>
                </View>
                <View style={[styles.alertBadge, item.severity === 'high' ? styles.alertBadgeHigh : styles.alertBadgeMed]}>
                  <Text style={[styles.alertBadgeText, item.severity === 'high' ? styles.alertBadgeTextHigh : styles.alertBadgeTextMed]}>
                    {item.severity}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

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

  forecastRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 8 },
  forecastCard: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    borderLeftWidth: 4, ...SHADOWS.card,
  },
  forecastLabel: { fontSize: 11, color: COLORS.gray500, fontWeight: '600' },
  forecastValue: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  forecastMeta: { fontSize: 11, color: COLORS.gray400, marginTop: 4, lineHeight: 16 },

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

  segmentSummaryRow: { flexDirection: 'row', gap: 8, padding: 14, paddingBottom: 10 },
  segmentSummaryCard: { flex: 1, borderRadius: 12, padding: 10 },
  segmentSummaryLabel: { fontSize: 11, fontWeight: '700', color: COLORS.gray500 },
  segmentSummaryValue: { fontSize: 20, fontWeight: '800', color: COLORS.gray900, marginTop: 4 },
  segmentRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.gray100,
  },
  segmentName: { fontSize: 13, color: COLORS.gray700, fontWeight: '500' },
  segmentCount: { fontSize: 14, color: COLORS.gray900, fontWeight: '700' },

  alertRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray100,
  },
  alertTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
  alertMeta: { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  alertHint: { fontSize: 12, color: COLORS.gray700, marginTop: 6, fontWeight: '500' },
  alertBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginTop: 2 },
  alertBadgeHigh: { backgroundColor: COLORS.redLight },
  alertBadgeMed: { backgroundColor: COLORS.amberLight },
  alertBadgeText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  alertBadgeTextHigh: { color: COLORS.red },
  alertBadgeTextMed: { color: COLORS.amber },

  actionsWrap: { paddingHorizontal: 16, gap: 10, marginTop: 2 },
  actionCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, ...SHADOWS.card },
  actionHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  actionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
  actionDescription: { fontSize: 12, color: COLORS.gray500, marginTop: 4, lineHeight: 18 },
  actionHighlights: { marginTop: 10, gap: 4 },
  actionHighlight: { fontSize: 12, color: COLORS.gray700, fontWeight: '500' },
  actionPriorityBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  actionPriorityHigh: { backgroundColor: COLORS.redLight },
  actionPriorityMedium: { backgroundColor: COLORS.amberLight },
  actionPriorityLow: { backgroundColor: COLORS.gray100 },
  actionPriorityText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  actionPriorityTextHigh: { color: COLORS.red },
  actionPriorityTextMedium: { color: COLORS.amber },
  actionPriorityTextLow: { color: COLORS.gray600 },
  actionButton: {
    marginTop: 12, alignSelf: 'flex-start', backgroundColor: COLORS.primary,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9,
  },
  actionButtonText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },

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
