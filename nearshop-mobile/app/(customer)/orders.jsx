import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getMyOrders, cancelOrder, downloadInvoice } from '../../lib/orders';
import { GenericListSkeleton } from '../../components/ui/ScreenSkeletons';
import { alert } from '../../components/ui/PremiumAlert';
import { COLORS, STATUS_COLORS, SHADOWS, formatPrice, formatDate } from '../../constants/theme';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const CANCELLABLE_STATUSES = ['pending', 'confirmed'];

const EMPTY_MESSAGES = {
  all: 'You have no orders yet.\nStart shopping to place your first order!',
  pending: 'No pending orders right now.',
  confirmed: 'No confirmed orders at the moment.',
  preparing: 'No orders being prepared right now.',
  ready: 'No orders are ready for pickup.',
  completed: 'You have no completed orders yet.',
  cancelled: 'You have no cancelled orders.',
};

function shortId(id) {
  if (!id) return '—';
  return id.replace(/-/g, '').slice(-8).toUpperCase();
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || COLORS.gray400;
  return (
    <View style={[styles.badge, { backgroundColor: color + '1A', borderColor: color + '44' }]}>
      <Text style={[styles.badgeText, { color }]}>
        {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
      </Text>
    </View>
  );
}

function OrderCard({ order, onCancel, onDownloadInvoice, onPress, downloadingInvoice }) {
  const statusColor = STATUS_COLORS[order.status] || COLORS.gray400;
  const canCancel = CANCELLABLE_STATUSES.includes(order.status);
  const canDownloadInvoice = order.status === 'completed';

  return (
    <TouchableOpacity
      style={[styles.card, SHADOWS.card, { borderLeftColor: statusColor }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Top row: order id + date */}
      <View style={styles.cardTopRow}>
        <Text style={styles.orderId}>#{shortId(order.id)}</Text>
        <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
      </View>

      {/* Shop info */}
      <Text style={styles.shopName} numberOfLines={1}>
        {order.shop_name || 'Unknown Shop'}
      </Text>
      {!!order.shop_category && (
        <Text style={styles.shopCategory}>{order.shop_category}</Text>
      )}

      {/* Middle row: items count + total */}
      <View style={styles.cardMidRow}>
        <Text style={styles.itemsCount}>
          {order.items_count != null
            ? `${order.items_count} ${order.items_count === 1 ? 'item' : 'items'}`
            : '—'}
        </Text>
        <Text style={styles.totalAmount}>{formatPrice(order.total_amount)}</Text>
      </View>

      {/* Bottom row: status badge + actions */}
      <View style={styles.cardBottomRow}>
        <StatusBadge status={order.status} />
        <View style={styles.cardActions}>
          {canDownloadInvoice && (
            <TouchableOpacity
              style={[styles.invoiceBtn, downloadingInvoice === order.id && styles.invoiceBtnDisabled]}
              onPress={() => onDownloadInvoice(order)}
              activeOpacity={0.7}
              disabled={downloadingInvoice === order.id}
            >
              {downloadingInvoice === order.id ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Text style={styles.invoiceBtnText}>📄 Invoice</Text>
              )}
            </TouchableOpacity>
          )}
          {canCancel && (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => onCancel(order)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function OrdersScreen() {
  const router = useRouter();

  // Handle Android hardware back → go back to profile, not home
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.navigate('/(customer)/profile');
      return true;
    });
    return () => handler.remove();
  }, [router]);

  const [activeFilter, setActiveFilter] = useState('all');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [downloadingInvoice, setDownloadingInvoice] = useState(null);
  const [error, setError] = useState(null);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = activeFilter === 'all' ? {} : { status: activeFilter };
      const res = await getMyOrders(params);
      const d = res?.data;
      let list = Array.isArray(d) ? d : d?.items ?? d?.orders ?? [];
      // Client-side filter as safety net if backend ignores status param
      if (activeFilter !== 'all') {
        list = list.filter(o => o.status === activeFilter);
      }
      setOrders(list);
    } catch (err) {
      setError('Failed to load orders. Pull down to retry.');
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleCancel = useCallback(async (order) => {
    const confirmed = await alert.confirm({
      title: 'Cancel Order',
      message: `Are you sure you want to cancel order #${shortId(order.id)}?`,
      confirmText: 'Cancel Order',
      cancelText: 'Keep Order',
      type: 'danger',
    });
    
    if (confirmed) {
      setCancellingId(order.id);
      try {
        await cancelOrder(order.id);
        await fetchOrders();
      } catch {
        alert.error({ title: 'Error', message: 'Could not cancel this order. Please try again.' });
      } finally {
        setCancellingId(null);
      }
    }
  }, [fetchOrders]);

  const handleDownloadInvoice = useCallback(async (order) => {
    setDownloadingInvoice(order.id);
    try {
      const response = await downloadInvoice(order.id);
      if (response.data) {
        // Save the file temporarily
        const fileUri = FileSystem.documentDirectory + `invoice-${shortId(order.id)}.pdf`;
        await FileSystem.writeAsStringAsync(fileUri, response.data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const canOpen = await Linking.canOpenURL(fileUri);
        if (canOpen) {
          await Linking.openURL(fileUri);
        }
        alert.success({
          title: 'Success',
          message: canOpen
            ? 'Invoice downloaded successfully!'
            : 'Invoice downloaded. Open it from your device files if it did not launch automatically.',
        });
      }
    } catch (err) {
      alert.error({ title: 'Error', message: 'Could not download invoice. Please try again.' });
    } finally {
      setDownloadingInvoice(null);
    }
  }, []);

  const handleCardPress = useCallback((order) => {
    router.push(`/(customer)/order-detail/${order.id}`);
  }, [router]);

  const renderOrder = useCallback(({ item }) => (
    <OrderCard
      order={item}
      onCancel={handleCancel}
      onDownloadInvoice={handleDownloadInvoice}
      onPress={() => handleCardPress(item)}
      downloadingInvoice={downloadingInvoice}
    />
  ), [handleCancel, handleDownloadInvoice, handleCardPress, downloadingInvoice]);

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📦</Text>
        <Text style={styles.emptyTitle}>No orders yet</Text>
        <Text style={styles.emptyMessage}>
          {EMPTY_MESSAGES[activeFilter] || EMPTY_MESSAGES.all}
        </Text>
      </View>
    );
  };

  const renderHeader = () => (
    <View>
      {/* Status filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterBar}
        style={styles.filterScroll}
      >
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={styles.filterTabWrapper}
              onPress={() => setActiveFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                {f.label}
              </Text>
              {isActive && <View style={styles.filterUnderline} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Error banner */}
      {!!error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Screen header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.navigate('/(customer)/profile')}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={styles.backBtn} />
      </View>

      {/* Loading state (initial) */}
      {loading && !refreshing ? (
        <GenericListSkeleton />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrder}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            orders.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchOrders(true)}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
        />
      )}

      {/* Full-screen dimmer while a cancel request is in-flight */}
      {cancellingId && (
        <View style={styles.cancelOverlay}>
          <ActivityIndicator size="large" color={COLORS.white} />
          <Text style={styles.cancelOverlayText}>Cancelling…</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  backBtn: {
    width: 36,
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 32,
    color: COLORS.gray700,
    lineHeight: 36,
    marginTop: -2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.gray900,
    letterSpacing: 0.2,
  },

  /* ── Filter tabs ── */
  filterScroll: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  filterBar: {
    paddingHorizontal: 12,
    paddingVertical: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  filterTabWrapper: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 0,
    alignItems: 'center',
    marginRight: 2,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray500,
    paddingBottom: 10,
  },
  filterLabelActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  filterUnderline: {
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    width: '100%',
    marginTop: -3,
  },

  /* ── Error banner ── */
  errorBanner: {
    backgroundColor: COLORS.redLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.red + '33',
  },
  errorText: {
    fontSize: 13,
    color: COLORS.red,
    textAlign: 'center',
  },

  /* ── List ── */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  listContentEmpty: {
    flexGrow: 1,
  },

  /* ── Order card ── */
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderId: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.gray500,
    letterSpacing: 0.8,
    fontFamily: 'monospace',
  },
  orderDate: {
    fontSize: 12,
    color: COLORS.gray400,
  },
  shopName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.gray900,
    marginBottom: 2,
  },
  shopCategory: {
    fontSize: 12,
    color: COLORS.gray500,
    marginBottom: 10,
  },
  cardMidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemsCount: {
    fontSize: 13,
    color: COLORS.gray600,
  },
  totalAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  /* ── Status badge ── */
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  /* ── Cancel button ── */
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.red,
    backgroundColor: COLORS.redLight,
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.red,
  },

  /* ── Card Actions ── */
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  /* ── Invoice button ── */
  invoiceBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
    minWidth: 80,
    alignItems: 'center',
  },
  invoiceBtnDisabled: {
    opacity: 0.6,
  },
  invoiceBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },

  /* ── Loader ── */
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loaderText: {
    fontSize: 14,
    color: COLORS.gray500,
    marginTop: 8,
  },

  /* ── Empty state ── */
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.gray700,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: COLORS.gray500,
    textAlign: 'center',
    lineHeight: 21,
  },

  /* ── Cancel overlay ── */
  cancelOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  cancelOverlayText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.white,
    marginTop: 8,
  },
});
