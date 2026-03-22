import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import useMyShop from '../../hooks/useMyShop';
import useLocationStore from '../../store/locationStore';
import { getShopStats, getProductAnalytics, getDemandInsights } from '../../lib/analytics';

const COLORS = {
  primary: '#7F77DD',
  green: '#1D9E75',
  amber: '#EF9F27',
  red: '#E24B4A',
  blue: '#3B8BD4',
  white: '#FFFFFF',
  bg: '#F9FAFB',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  primaryLight: '#EEEDFE',
  greenLight: '#E1F5EE',
  amberLight: '#FAEEDA',
  blueLight: '#E6F1FB',
};

const SHADOWS = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
};

const formatPrice = (p) => '₹' + Number(p).toLocaleString('en-IN');

const PERIODS = ['7d', '30d', '90d'];

const STAT_CONFIG = [
  { key: 'revenue', label: 'Revenue', borderColor: COLORS.green, format: (v) => formatPrice(v || 0) },
  { key: 'orders', label: 'Orders', borderColor: COLORS.primary, format: (v) => String(v || 0) },
  { key: 'visitors', label: 'Visitors', borderColor: COLORS.blue, format: (v) => String(v || 0) },
  { key: 'views', label: 'Views', borderColor: COLORS.amber, format: (v) => String(v || 0) },
];

export default function AnalyticsScreen() {
  const { shopId } = useMyShop();
  const { lat, lng } = useLocationStore();
  const [period, setPeriod] = useState('30d');
  const [stats, setStats] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [demandInsights, setDemandInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const [statsRes, productsRes, insightsRes] = await Promise.allSettled([
        getShopStats(shopId, period),
        getProductAnalytics(shopId),
        getDemandInsights(shopId, lat, lng),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value?.data ?? null);
      if (productsRes.status === 'fulfilled') {
        const d = productsRes.value?.data;
        setTopProducts(d?.items ?? d?.products ?? d ?? []);
      }
      if (insightsRes.status === 'fulfilled') {
        const d = insightsRes.value?.data;
        setDemandInsights(d?.items ?? d?.insights ?? d ?? []);
      }
    } catch (e) {
      setError('Failed to load analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [shopId, period, lat, lng]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading && !stats) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📊 Analytics</Text>
        </View>
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView edges={['top']} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📊 Analytics</Text>
        </View>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadData}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📊 Analytics</Text>
        </View>

        {/* Period Selector */}
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.periodPill, period === p && styles.periodPillActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {STAT_CONFIG.map((cfg) => (
            <View
              key={cfg.key}
              style={[styles.statCard, { borderLeftColor: cfg.borderColor }]}
            >
              <Text style={styles.statValue}>{cfg.format(stats?.[cfg.key])}</Text>
              <Text style={styles.statLabel}>{cfg.label}</Text>
            </View>
          ))}
        </View>

        {/* Top Products */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Products</Text>
          {topProducts.length === 0 ? (
            <Text style={styles.emptySection}>No product data yet</Text>
          ) : (
            topProducts.map((item, index) => (
              <View key={item.id || index} style={styles.productRow}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{index + 1}</Text>
                </View>
                <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.productViews}>{item.views || 0} views</Text>
              </View>
            ))
          )}
        </View>

        {/* Demand Insights */}
        <View style={[styles.section, { marginBottom: 32 }]}>
          <Text style={styles.sectionTitle}>Demand Insights</Text>
          <Text style={styles.sectionSubtitle}>Top searches near your shop</Text>
          {demandInsights.length === 0 ? (
            <Text style={styles.emptySection}>No demand data available yet</Text>
          ) : (
            <View style={styles.tagsWrap}>
              {demandInsights.map((term, index) => (
                <View key={index} style={styles.demandTag}>
                  <Text style={styles.demandTagText}>
                    {typeof term === 'string' ? term : term.query || term.term}
                  </Text>
                  {term.count && (
                    <Text style={styles.demandTagCount}>{term.count}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  periodRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  periodPill: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  periodPillActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  periodText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray600,
  },
  periodTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  statCard: {
    width: '46%',
    margin: '2%',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    ...SHADOWS.card,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.gray900,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: COLORS.gray500,
    fontWeight: '500',
  },
  section: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.gray800,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.gray500,
    marginBottom: 12,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    ...SHADOWS.card,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  productName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray800,
  },
  productViews: {
    fontSize: 13,
    color: COLORS.gray500,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  demandTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blueLight,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  demandTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.blue,
  },
  demandTagCount: {
    fontSize: 12,
    color: COLORS.blue,
    opacity: 0.7,
  },
  emptySection: {
    fontSize: 14,
    color: COLORS.gray400,
    paddingVertical: 12,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 15,
    color: COLORS.red,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 11,
    borderRadius: 10,
  },
  retryBtnText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
