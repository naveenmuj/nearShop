import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  RefreshControl, TouchableOpacity, StatusBar, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import client from '../lib/api';
import { COLORS, SHADOWS, formatPrice } from '../constants/theme';

// ── Mini bar chart ──────────────────────────────────────────────────────────
function BarChart({ data = [], valueKey = 'count', labelKey = 'status', color = COLORS.primary }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => Number(d[valueKey] ?? 0)), 1);
  return (
    <View style={bc.wrap}>
      {data.map((item, i) => {
        const pct = (Number(item[valueKey] ?? 0) / max) * 100;
        return (
          <View key={i} style={bc.col}>
            <Text style={bc.val}>{item[valueKey] ?? 0}</Text>
            <View style={bc.track}>
              <View style={[bc.bar, { height: `${Math.max(pct, 2)}%`, backgroundColor: color }]} />
            </View>
            <Text style={bc.label} numberOfLines={1}>{item[labelKey] ?? ''}</Text>
          </View>
        );
      })}
    </View>
  );
}
const bc = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 6, paddingTop: 8 },
  col: { flex: 1, alignItems: 'center' },
  val: { fontSize: 10, fontWeight: '700', color: COLORS.gray700, marginBottom: 2 },
  track: { width: '80%', height: 72, justifyContent: 'flex-end', backgroundColor: COLORS.gray100, borderRadius: 4 },
  bar: { width: '100%', borderRadius: 4 },
  label: { fontSize: 9, color: COLORS.gray400, marginTop: 4, textTransform: 'capitalize', maxWidth: 40 },
});

// ── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color = COLORS.primary, sub }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

// ── Section ─────────────────────────────────────────────────────────────────
function Section({ title, children, style }) {
  return (
    <View style={[styles.section, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ── Metric row ───────────────────────────────────────────────────────────────
function MetricRow({ label, value, highlight }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, highlight && { color: COLORS.green }]}>{value}</Text>
    </View>
  );
}

const STATUS_COLOR = {
  pending: COLORS.amber, confirmed: COLORS.blue, preparing: COLORS.primary,
  ready: COLORS.teal, completed: COLORS.green, cancelled: COLORS.red,
};

// ── Main screen ─────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => { router.back(); return true; });
    return () => h.remove();
  }, []);

  const load = useCallback(async () => {
    try {
      setError(null);
      const results = await Promise.allSettled([
        client.get('/admin/overview'),
        client.get('/admin/shops/leaderboard', { params: { limit: 5 } }),
        client.get('/admin/products/top-viewed', { params: { limit: 5 } }),
        client.get('/admin/users/recent', { params: { limit: 8 } }),
        client.get('/admin/orders/funnel'),
        client.get('/admin/users/segmentation'),
      ]);
      const [overviewR, shopsR, prodsR, usersR, funnelR, segR] = results;
      setData({
        overview: overviewR.status === 'fulfilled' ? overviewR.value.data : null,
        shops: shopsR.status === 'fulfilled' ? (Array.isArray(shopsR.value.data) ? shopsR.value.data : shopsR.value.data?.items ?? []) : [],
        products: prodsR.status === 'fulfilled' ? (Array.isArray(prodsR.value.data) ? prodsR.value.data : prodsR.value.data?.items ?? []) : [],
        users: usersR.status === 'fulfilled' ? (Array.isArray(usersR.value.data) ? usersR.value.data : usersR.value.data?.items ?? []) : [],
        funnel: funnelR.status === 'fulfilled' ? (Array.isArray(funnelR.value.data) ? funnelR.value.data : []) : [],
        seg: segR.status === 'fulfilled' ? segR.value.data : null,
      });
      if (overviewR.status !== 'fulfilled') {
        setError(overviewR.reason?.response?.data?.detail || 'Failed to load platform data');
      }
    } catch (e) {
      setError(e?.response?.data?.detail || 'Failed to load');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const { overview, shops, products, users, funnel, seg } = data;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSub}>Platform overview</Text>
        </View>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading platform data…</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          contentContainerStyle={styles.scroll}
        >
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>⚠ {error}</Text>
              <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Overview stats ── */}
          {overview && (
            <>
              <Section title="📊 Platform Overview">
                <View style={styles.statsGrid}>
                  <StatCard label="Total Users" value={overview.total_users ?? 0} icon="👥" color={COLORS.blue}
                    sub={`+${overview.new_users_7d ?? 0} this week`} />
                  <StatCard label="Active Shops" value={overview.total_shops ?? 0} icon="🏪" color={COLORS.green}
                    sub={`${overview.verified_shops ?? 0} verified`} />
                  <StatCard label="Products" value={overview.total_products ?? 0} icon="📦" color={COLORS.primary}
                    sub={`${overview.available_products ?? 0} available`} />
                  <StatCard label="Total Orders" value={overview.total_orders ?? 0} icon="🛒" color={COLORS.amber}
                    sub={`${overview.orders_7d ?? 0} this week`} />
                  <StatCard label="Total GMV" value={formatPrice(overview.gmv_total ?? 0)} icon="💰" color="#1D9E75"
                    sub={`${formatPrice(overview.gmv_7d ?? 0)} this week`} />
                  <StatCard label="Avg Rating" value={`${overview.avg_platform_rating ?? 0}⭐`} icon="⭐" color="#EF9F27"
                    sub={`${overview.total_reviews ?? 0} reviews`} />
                </View>
              </Section>

              {/* This week metrics */}
              <Section title="📅 This Week's Metrics">
                <View style={styles.card}>
                  <MetricRow label="New Users" value={overview.new_users_7d ?? 0} highlight />
                  <MetricRow label="New Shops" value={overview.new_shops_7d ?? 0} highlight />
                  <MetricRow label="New Products" value={overview.new_products_7d ?? 0} />
                  <MetricRow label="Orders" value={overview.orders_7d ?? 0} highlight />
                  <MetricRow label="Revenue" value={formatPrice(overview.gmv_7d ?? 0)} highlight />
                  <MetricRow label="Avg Order Value" value={formatPrice(overview.avg_order_value ?? 0)} />
                  <MetricRow label="Cancel Rate" value={`${overview.cancellation_rate ?? 0}%`} />
                  <MetricRow label="Active Deals" value={overview.active_deals ?? 0} />
                  <MetricRow label="Haggles" value={overview.total_haggles ?? 0} />
                  <MetricRow label="Community Posts" value={overview.community_posts ?? 0} />
                  <MetricRow label="Active Stories" value={overview.active_stories ?? 0} />
                  <MetricRow label="ShopCoins Earned" value={formatPrice(overview.coins_earned ?? 0)} />
                </View>
              </Section>
            </>
          )}

          {/* ── Order Funnel ── */}
          {Array.isArray(funnel) && funnel.length > 0 && (
            <Section title="🔁 Order Funnel">
              <View style={styles.card}>
                <BarChart
                  data={funnel}
                  valueKey="count"
                  labelKey="status"
                  color={COLORS.primary}
                />
                <View style={{ height: 12 }} />
                {funnel.map((item) => (
                  <View key={item.status} style={styles.funnelRow}>
                    <View style={[styles.funnelDot, { backgroundColor: STATUS_COLOR[item.status] || COLORS.gray400 }]} />
                    <Text style={styles.funnelLabel}>{item.status}</Text>
                    <Text style={styles.funnelCount}>{item.count ?? 0}</Text>
                    {item.count > 0 && item.status !== 'cancelled' && (
                      <View style={[styles.funnelBar, { width: `${Math.min((item.count / (funnel[0]?.count || 1)) * 60, 60)}%`, backgroundColor: STATUS_COLOR[item.status] + '33' }]} />
                    )}
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* ── User Segmentation ── */}
          {seg && (
            <Section title="👤 User Segments">
              <View style={styles.card}>
                {seg.customers !== undefined && <MetricRow label="Customers" value={seg.customers ?? 0} highlight />}
                {seg.businesses !== undefined && <MetricRow label="Business Owners" value={seg.businesses ?? 0} highlight />}
                {seg.both_roles !== undefined && <MetricRow label="Both Roles" value={seg.both_roles ?? 0} />}
                {seg.with_name !== undefined && <MetricRow label="Completed Profiles" value={seg.with_name ?? 0} />}
                {seg.with_phone !== undefined && <MetricRow label="With Phone" value={seg.with_phone ?? 0} />}
                {seg.inactive !== undefined && <MetricRow label="Inactive" value={seg.inactive ?? 0} />}
              </View>
            </Section>
          )}

          {/* ── Top Shops ── */}
          {shops.length > 0 && (
            <Section title="🏆 Top Shops">
              <View style={styles.card}>
                {shops.map((s, i) => (
                  <View key={s.id || i} style={[styles.listRow, i === shops.length - 1 && styles.listRowLast]}>
                    <View style={[styles.rankBadge, i === 0 && styles.rankGold, i === 1 && styles.rankSilver, i === 2 && styles.rankBronze]}>
                      <Text style={styles.rankText}>{i + 1}</Text>
                    </View>
                    <View style={styles.listInfo}>
                      <Text style={styles.listName} numberOfLines={1}>{s.name}</Text>
                      <Text style={styles.listSub}>{s.category} · {s.products ?? 0} products</Text>
                    </View>
                    <View style={styles.scorePill}>
                      <Text style={styles.scoreText}>{Number(s.score ?? 0).toFixed(1)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* ── Top Products ── */}
          {products.length > 0 && (
            <Section title="👁 Most Viewed Products">
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
                    <Text style={styles.viewCount}>👁 {p.view_count ?? 0}</Text>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {/* ── Recent Users ── */}
          {users.length > 0 && (
            <Section title="🆕 Recent Users">
              <View style={styles.card}>
                {users.map((u, i) => {
                  const initials = ((u.name || u.phone || '?')[0] || '?').toUpperCase();
                  return (
                    <View key={u.id || i} style={[styles.listRow, i === users.length - 1 && styles.listRowLast]}>
                      <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
                      <View style={styles.listInfo}>
                        <Text style={styles.listName} numberOfLines={1}>{u.name || u.phone || 'User'}</Text>
                        <Text style={styles.listSub}>{u.active_role || 'customer'} · {u.phone || u.email || '—'}</Text>
                      </View>
                      <View style={[styles.roleBadge, u.active_role === 'business' && styles.roleBadgeBiz]}>
                        <Text style={[styles.roleText, u.active_role === 'business' && styles.roleTextBiz]}>
                          {u.active_role || 'customer'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Section>
          )}

          <View style={{ height: 48 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: COLORS.gray400, fontSize: 14 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#1a1a2e',
  },
  backBtn: { paddingRight: 8 },
  backText: { fontSize: 15, fontWeight: '600', color: '#9fa8da' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff', textAlign: 'center' },
  headerSub: { fontSize: 11, color: '#9fa8da', textAlign: 'center', marginTop: 1 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.green },
  liveText: { fontSize: 12, fontWeight: '700', color: COLORS.green },

  scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },

  errorBanner: {
    backgroundColor: COLORS.redLight, padding: 14, borderRadius: 12, marginTop: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  errorText: { color: COLORS.red, fontWeight: '600', fontSize: 13, flex: 1 },
  retryBtn: { backgroundColor: COLORS.red, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  section: { marginTop: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.gray900, marginBottom: 10, letterSpacing: 0.2 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '47%', backgroundColor: COLORS.white, borderRadius: 14, padding: 14,
    ...SHADOWS.card,
  },
  statIcon: { fontSize: 22, marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  statLabel: { fontSize: 11, color: COLORS.gray500, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  statSub: { fontSize: 11, color: COLORS.gray400, marginTop: 4 },

  card: { backgroundColor: COLORS.white, borderRadius: 14, overflow: 'hidden', ...SHADOWS.card },

  metricRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray100,
  },
  metricLabel: { fontSize: 14, color: COLORS.gray600 },
  metricValue: { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },

  funnelRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray100,
  },
  funnelDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  funnelLabel: { flex: 1, fontSize: 13, fontWeight: '500', color: COLORS.gray700, textTransform: 'capitalize' },
  funnelCount: { fontSize: 15, fontWeight: '800', color: COLORS.gray900, marginRight: 8 },
  funnelBar: { position: 'absolute', right: 16, height: 20, borderRadius: 4 },

  listRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray100,
  },
  listRowLast: { borderBottomWidth: 0 },
  rankBadge: {
    width: 30, height: 30, borderRadius: 8, backgroundColor: COLORS.amberLight,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  rankGold: { backgroundColor: '#FEF3C7' },
  rankSilver: { backgroundColor: '#F3F4F6' },
  rankBronze: { backgroundColor: '#FEF0E7' },
  rankText: { fontSize: 13, fontWeight: '800', color: COLORS.amber },
  listInfo: { flex: 1 },
  listName: { fontSize: 14, fontWeight: '600', color: COLORS.gray900 },
  listSub: { fontSize: 12, color: COLORS.gray400, marginTop: 2 },
  scorePill: {
    backgroundColor: COLORS.greenLight, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20,
  },
  scoreText: { fontSize: 13, fontWeight: '800', color: COLORS.green },
  viewCount: { fontSize: 12, color: COLORS.gray400, fontWeight: '600' },

  avatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },

  roleBadge: {
    backgroundColor: COLORS.gray100, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
  },
  roleBadgeBiz: { backgroundColor: COLORS.greenLight },
  roleText: { fontSize: 11, fontWeight: '600', color: COLORS.gray500, textTransform: 'capitalize' },
  roleTextBiz: { color: COLORS.green },
});
