import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import useMyShop from '../../hooks/useMyShop';
import { getShopOrders, updateOrderStatus } from '../../lib/orders';

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
  redLight: '#FCEBEB',
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

const STATUS_COLORS = {
  pending: '#EF9F27',
  confirmed: '#3B8BD4',
  preparing: '#7F77DD',
  ready: '#5DCAA5',
  completed: '#1D9E75',
  cancelled: '#E24B4A',
};

const NEXT_STATUS = {
  pending: 'confirmed',
  confirmed: 'preparing',
  preparing: 'ready',
  ready: 'completed',
};

const PROGRESS_LABEL = {
  confirmed: 'Mark Preparing',
  preparing: 'Mark Ready',
  ready: 'Mark Complete',
};

const STATUS_TABS = ['all', 'pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];

const formatPrice = (p) => '₹' + Number(p).toLocaleString('en-IN');

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) +
    ', ' + d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function BizOrdersScreen() {
  const { shopId } = useMyShop();
  const [activeTab, setActiveTab] = useState('all');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef(null);

  const loadOrders = useCallback(async (silent = false) => {
    if (!shopId) return;
    if (!silent) setLoading(true);
    try {
      const data = await getShopOrders(shopId, {
        status: activeTab === 'all' ? undefined : activeTab,
      });
      setOrders(data || []);
    } catch {
      if (!silent) Alert.alert('Error', 'Failed to load orders');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [shopId, activeTab]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Poll every 15 seconds when on pending tab
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (activeTab === 'pending' || activeTab === 'all') {
      intervalRef.current = setInterval(() => loadOrders(true), 15000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeTab, loadOrders]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders(true);
    setRefreshing(false);
  };

  const handleAccept = async (order) => {
    try {
      await updateOrderStatus(order.id, 'confirmed');
      loadOrders(true);
    } catch {
      Alert.alert('Error', 'Failed to accept order');
    }
  };

  const handleReject = (order) => {
    Alert.alert(
      'Reject Order',
      `Reject order #${order.id.slice(-6).toUpperCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateOrderStatus(order.id, 'cancelled');
              loadOrders(true);
            } catch {
              Alert.alert('Error', 'Failed to reject order');
            }
          },
        },
      ]
    );
  };

  const handleProgress = async (order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    try {
      await updateOrderStatus(order.id, next);
      loadOrders(true);
    } catch {
      Alert.alert('Error', 'Failed to update order status');
    }
  };

  const renderOrder = ({ item }) => {
    const borderColor = STATUS_COLORS[item.status] || COLORS.gray300;
    const itemCount = item.items?.length ?? item.item_count ?? 0;
    const isPending = item.status === 'pending';
    const hasProgress = ['confirmed', 'preparing', 'ready'].includes(item.status);

    return (
      <View style={[styles.orderCard, { borderLeftColor: borderColor }]}>
        <View style={styles.orderTop}>
          <Text style={styles.orderId}>#{(item.id || '').slice(-6).toUpperCase()}</Text>
          <View style={[styles.statusBadge, { backgroundColor: borderColor + '20' }]}>
            <Text style={[styles.statusBadgeText, { color: borderColor }]}>
              {item.status?.charAt(0).toUpperCase() + item.status?.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.orderMeta}>
          <Text style={styles.customerName}>{item.customer_name || 'Customer'}</Text>
          <Text style={styles.itemCount}>{itemCount} item{itemCount !== 1 ? 's' : ''}</Text>
        </View>

        <View style={styles.orderBottom}>
          <Text style={styles.orderTotal}>{formatPrice(item.total_amount || 0)}</Text>
          <Text style={styles.orderTime}>{formatDate(item.created_at)}</Text>
        </View>

        {isPending && (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={() => handleAccept(item)}
            >
              <Text style={styles.acceptBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.rejectBtn]}
              onPress={() => handleReject(item)}
            >
              <Text style={styles.rejectBtnText}>Reject</Text>
            </TouchableOpacity>
          </View>
        )}

        {hasProgress && (
          <TouchableOpacity
            style={styles.progressBtn}
            onPress={() => handleProgress(item)}
          >
            <Text style={styles.progressBtnText}>{PROGRESS_LABEL[item.status]}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
      </View>

      {/* Status Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContent}
      >
        {STATUS_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Orders List */}
      {loading && orders.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrder}
          contentContainerStyle={orders.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>🛒</Text>
              <Text style={styles.emptyTitle}>No orders yet</Text>
            </View>
          }
        />
      )}
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
  tabsScroll: {
    flexGrow: 0,
    marginBottom: 12,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray200,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray600,
  },
  tabTextActive: {
    color: COLORS.white,
    fontWeight: '600',
  },
  orderCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    ...SHADOWS.card,
  },
  orderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderId: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.gray700,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray800,
  },
  itemCount: {
    fontSize: 13,
    color: COLORS.gray500,
  },
  orderBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  orderTime: {
    fontSize: 12,
    color: COLORS.gray400,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: COLORS.greenLight,
  },
  acceptBtnText: {
    color: COLORS.green,
    fontWeight: '700',
    fontSize: 14,
  },
  rejectBtn: {
    backgroundColor: COLORS.redLight,
  },
  rejectBtnText: {
    color: COLORS.red,
    fontWeight: '700',
    fontSize: 14,
  },
  progressBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  progressBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.gray500,
  },
});
