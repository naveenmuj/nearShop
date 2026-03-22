import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  ActivityIndicator, RefreshControl, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { COLORS, SHADOWS, formatPrice } from '../../constants/theme';
import useMyShop from '../../hooks/useMyShop';
import useAuthStore from '../../store/authStore';
import { getShopStats } from '../../lib/analytics';
import { getShopOrders } from '../../lib/orders';
import { switchRole } from '../../lib/auth';

export default function BizDashboardScreen() {
  const { shop, shopId, loading: shopLoading } = useMyShop();
  const { user, switchRole: storeSwitchRole, logout } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!shopId) { setLoading(false); return; }
    try {
      const [statsRes, ordersRes] = await Promise.allSettled([
        getShopStats(shopId, '7d'),
        getShopOrders(shopId, { status: 'pending', limit: 5 }),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (ordersRes.status === 'fulfilled') {
        const d = ordersRes.value?.data;
        setPendingOrders(Array.isArray(d) ? d : d?.items ?? d?.orders ?? []);
      }
    } catch {}
    finally { setLoading(false); }
  }, [shopId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleSwitchToCustomer = async () => {
    try {
      await switchRole('customer');
      storeSwitchRole('customer');
      router.replace('/(customer)/home');
    } catch {
      Alert.alert('Error', 'Could not switch role');
    }
  };

  if (shopLoading || loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const statCards = [
    { label: 'Total Orders', value: stats?.total_orders ?? 0, color: COLORS.primary, icon: '🛍️' },
    { label: 'Revenue', value: formatPrice(stats?.total_revenue ?? 0), color: COLORS.green, icon: '💰' },
    { label: 'Views', value: stats?.total_views ?? 0, color: COLORS.amber, icon: '👁️' },
    { label: 'Visitors', value: stats?.unique_visitors ?? 0, color: COLORS.blue, icon: '👥' },
  ];

  const insightMsg = stats
    ? `You've had ${stats.total_orders ?? 0} orders and ${formatPrice(stats.total_revenue ?? 0)} in revenue this week. Keep it up!`
    : 'Add products and share your shop to start getting orders from nearby customers.';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        contentContainerStyle={styles.content}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Good day,</Text>
            <Text style={styles.shopName} numberOfLines={1}>{shop?.name || 'your shop'} 👋</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable style={styles.notifBtn} onPress={() => router.push('/(business)/orders')}>
              <Ionicons name="notifications-outline" size={20} color={COLORS.gray600} />
              {pendingOrders.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{pendingOrders.length}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* No shop warning */}
        {!shopId && (
          <View style={styles.noShopCard}>
            <Text style={styles.noShopIcon}>🏪</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.noShopTitle}>Set up your shop</Text>
              <Text style={styles.noShopSub}>Complete your shop profile to start selling</Text>
            </View>
          </View>
        )}

        {/* Stats 2x2 */}
        <View style={styles.statsGrid}>
          {statCards.map((s) => (
            <View key={s.label} style={[styles.statCard, { borderLeftColor: s.color }]}>
              <Text style={styles.statIcon}>{s.icon}</Text>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={[styles.statPeriod, { color: COLORS.green }]}>This week</Text>
            </View>
          ))}
        </View>

        {/* AI Insight */}
        <View style={styles.insightCard}>
          <Text style={styles.insightIcon}>✨</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.insightTitle}>AI Insight</Text>
            <Text style={styles.insightMsg}>{insightMsg}</Text>
          </View>
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <View style={styles.quickActions}>
          {[
            { icon: '📸', label: 'Add Product', onPress: () => router.push('/(business)/snap-list') },
            { icon: '📦', label: 'Catalog', onPress: () => router.push('/(business)/catalog') },
            { icon: '📊', label: 'Analytics', onPress: () => router.push('/(business)/analytics') },
            { icon: '👤', label: 'Customer', onPress: handleSwitchToCustomer },
          ].map((a) => (
            <Pressable key={a.label} style={styles.quickBtn} onPress={a.onPress}>
              <Text style={styles.quickIcon}>{a.icon}</Text>
              <Text style={styles.quickLabel}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Pending orders needing attention */}
        {pendingOrders.length > 0 && (
          <View style={styles.pendingSection}>
            <View style={styles.pendingHeader}>
              <Text style={styles.sectionLabel}>NEEDS ATTENTION</Text>
              <Pressable onPress={() => router.push('/(business)/orders')}>
                <Text style={styles.viewAll}>View all</Text>
              </Pressable>
            </View>
            {pendingOrders.map((order) => (
              <View key={order.id} style={styles.pendingCard}>
                <View>
                  <Text style={styles.orderId}>Order #{String(order.id).slice(-6)}</Text>
                  <Text style={styles.orderTotal}>{formatPrice(order.total_amount ?? order.total ?? 0)}</Text>
                </View>
                <Pressable
                  style={styles.manageBtn}
                  onPress={() => router.push('/(business)/orders')}
                >
                  <Text style={styles.manageBtnText}>Manage</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: 100 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
    backgroundColor: COLORS.white, ...SHADOWS.card,
  },
  greeting: { fontSize: 12, color: COLORS.gray400, fontWeight: '500' },
  shopName: { fontSize: 20, fontWeight: '800', color: COLORS.primary, marginTop: 2 },
  headerRight: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  notifBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.gray100, justifyContent: 'center', alignItems: 'center',
  },
  badge: {
    position: 'absolute', top: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.red, justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { color: COLORS.white, fontSize: 9, fontWeight: '700' },
  noShopCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.amberLight, borderRadius: 16, padding: 16,
    margin: 16, borderWidth: 1, borderColor: COLORS.amber + '40',
  },
  noShopIcon: { fontSize: 32 },
  noShopTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
  noShopSub: { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 12, gap: 12 },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: COLORS.white, borderRadius: 16,
    padding: 16, borderLeftWidth: 4, ...SHADOWS.card,
  },
  statIcon: { fontSize: 20, marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '800', color: COLORS.gray900 },
  statLabel: { fontSize: 11, color: COLORS.gray400, fontWeight: '500', marginTop: 2 },
  statPeriod: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  insightCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    marginHorizontal: 16, marginBottom: 20, borderRadius: 20, padding: 16,
    backgroundColor: COLORS.primary,
  },
  insightIcon: { fontSize: 24 },
  insightTitle: { fontSize: 14, fontWeight: '700', color: COLORS.white, marginBottom: 4 },
  insightMsg: { fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.gray400,
    letterSpacing: 0.8, paddingHorizontal: 20, marginBottom: 12,
  },
  quickActions: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 24 },
  quickBtn: {
    flex: 1, backgroundColor: COLORS.white, borderRadius: 16,
    paddingVertical: 14, alignItems: 'center', gap: 6, ...SHADOWS.card,
  },
  quickIcon: { fontSize: 24 },
  quickLabel: { fontSize: 10, fontWeight: '600', color: COLORS.gray500, textAlign: 'center' },
  pendingSection: { paddingHorizontal: 16 },
  pendingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  viewAll: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  pendingCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 8, ...SHADOWS.card,
  },
  orderId: { fontSize: 14, fontWeight: '700', color: COLORS.gray900, fontVariant: ['tabular-nums'] },
  orderTotal: { fontSize: 13, color: COLORS.gray500, marginTop: 2 },
  manageBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  manageBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
});
