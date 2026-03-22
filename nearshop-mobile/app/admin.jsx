import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import client from '../lib/api';
import { COLORS, SHADOWS, formatPrice } from '../constants/theme';

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
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
      const [overviewRes, shopsRes, productsRes, usersRes, funnelRes] = await Promise.allSettled([
        client.get('/admin/overview'),
        client.get('/admin/shops/leaderboard', { params: { limit: 5 } }),
        client.get('/admin/products/top-viewed', { params: { limit: 5 } }),
        client.get('/admin/users/recent', { params: { limit: 8 } }),
        client.get('/admin/orders/funnel'),
      ]);

      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data);
      if (shopsRes.status === 'fulfilled') {
        const d = shopsRes.value.data;
        setShopLeaderboard(d.shops ?? d.items ?? d ?? []);
      }
      if (productsRes.status === 'fulfilled') {
        const d = productsRes.value.data;
        setTopProducts(d.products ?? d.items ?? d ?? []);
      }
      if (usersRes.status === 'fulfilled') {
        const d = usersRes.value.data;
        setRecentUsers(d.users ?? d.items ?? d ?? []);
      }
      if (funnelRes.status === 'fulfilled') setOrderFunnel(funnelRes.value.data);
    } catch {
      setError('Failed to load admin data');
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
        <View style={styles.center}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSub}>Platform Overview</Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Overview stats ──────────────────────────────────────────── */}
        {overview && (
          <View style={styles.statsGrid}>
            <StatCard label="Total Users" value={overview.total_users ?? 0} icon="👥" color={COLORS.blue} />
            <StatCard label="Total Shops" value={overview.total_shops ?? 0} icon="🏪" color={COLORS.green} />
            <StatCard label="Products" value={overview.total_products ?? 0} icon="📦" color={COLORS.primary} />
            <StatCard label="Orders" value={overview.total_orders ?? 0} icon="🛒" color={COLORS.amber} />
          </View>
        )}

        {/* ── Order funnel ────────────────────────────────────────────── */}
        {orderFunnel && (
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

        {/* ── Top shops ───────────────────────────────────────────────── */}
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
                    <Text style={styles.listSub}>{shop.category || 'N/A'} · {shop.total_products ?? 0} products</Text>
                  </View>
                  <View style={styles.listRight}>
                    <Text style={styles.listScore}>{Number(shop.score ?? 0).toFixed(1)}</Text>
                    <Text style={styles.listScoreLabel}>score</Text>
                  </View>
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* ── Top products ────────────────────────────────────────────── */}
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
                    <Text style={styles.listSub}>{formatPrice(p.price)} · {p.view_count ?? 0} views</Text>
                  </View>
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* ── Recent users ────────────────────────────────────────────── */}
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
                    <Text style={styles.listSub}>{u.role || 'customer'} · {u.phone || u.email || ''}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Section>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const STATUS_COLOR = {
  pending: '#EF9F27',
  confirmed: '#3B8BD4',
  preparing: '#7F77DD',
  ready: '#5DCAA5',
  completed: '#1D9E75',
  delivered: '#1D9E75',
  cancelled: '#E24B4A',
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#4338CA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: COLORS.bg },
  loadingText: { color: COLORS.gray400, fontSize: 14 },

  // Header
  header: {
    backgroundColor: '#4338CA',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  backBtn: { marginBottom: 12 },
  backText: { color: 'rgba(255,255,255,0.8)', fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.white },
  headerSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  errorBanner: {
    backgroundColor: COLORS.redLight, padding: 12, marginHorizontal: 16, marginTop: 12, borderRadius: 10,
  },
  errorText: { color: COLORS.red, fontWeight: '600', fontSize: 13 },

  // Stats grid
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 16,
    backgroundColor: COLORS.bg, gap: 10,
  },
  statCard: {
    width: '47%', backgroundColor: COLORS.white, borderRadius: 14, padding: 16,
    borderLeftWidth: 4, ...SHADOWS.card,
  },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 12, color: COLORS.gray500, fontWeight: '500', marginTop: 2 },

  // Sections
  section: { paddingHorizontal: 16, paddingTop: 20, backgroundColor: COLORS.bg },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray900, marginBottom: 10 },

  // Funnel card
  funnelCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, ...SHADOWS.card },
  funnelRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  funnelDot: { width: 10, height: 10, borderRadius: 5 },
  funnelLabel: { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.gray700, textTransform: 'capitalize' },
  funnelCount: { fontSize: 16, fontWeight: '700', color: COLORS.gray900 },

  // List card
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

  // User avatar
  userAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  userAvatarText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
