import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, StatusBar, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS, SHADOWS, formatPrice, formatDate } from '../../../constants/theme';
import { cancelOrder, getMyOrders, getOrderById } from '../../../lib/orders';
import { alert } from '../../../components/ui/PremiumAlert';
import { GenericDetailSkeleton } from '../../../components/ui/ScreenSkeletons';

const STATUS_STEPS = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];
const STATUS_LABELS = {
  pending: 'Order Placed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready for Pickup',
  completed: 'Delivered',
  cancelled: 'Cancelled',
};
const STATUS_COLORS = {
  pending: '#EF9F27',
  confirmed: '#3B8BD4',
  preparing: '#7F77DD',
  ready: '#5DCAA5',
  completed: '#1D9E75',
  cancelled: '#E24B4A',
};

function shortId(id) {
  if (!id) return '';
  return id.replace(/-/g, '').slice(-8).toUpperCase();
}

function StatusTimeline({ currentStatus }) {
  const isCancelled = currentStatus === 'cancelled';
  const currentIdx = STATUS_STEPS.indexOf(currentStatus);

  if (isCancelled) {
    return (
      <View style={ts.container}>
        <View style={ts.row}>
          <View style={[ts.dot, { backgroundColor: STATUS_COLORS.cancelled }]} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[ts.stepLabel, { color: STATUS_COLORS.cancelled, fontWeight: '700' }]}>Order Cancelled</Text>
            <Text style={ts.stepSub}>This order has been cancelled</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={ts.container}>
      {STATUS_STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const isActive = idx === currentIdx;
        const isLast = idx === STATUS_STEPS.length - 1;
        const color = done ? STATUS_COLORS[step] || COLORS.primary : COLORS.gray300;

        return (
          <View key={step}>
            <View style={ts.row}>
              <View style={[ts.dot, { backgroundColor: color }, isActive && ts.dotActive]}>
                {done && <Text style={ts.dotCheck}>✓</Text>}
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[ts.stepLabel, done && { color: COLORS.gray900, fontWeight: '700' }]}>
                  {STATUS_LABELS[step]}
                </Text>
                {isActive && <Text style={[ts.stepSub, { color }]}>Current status</Text>}
              </View>
            </View>
            {!isLast && (
              <View style={[ts.line, { backgroundColor: done && idx < currentIdx ? color : COLORS.gray200 }]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const ts = StyleSheet.create({
  container: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: {
    width: 24, height: 24, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  dotActive: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 3, borderColor: 'rgba(127,119,221,0.2)',
  },
  dotCheck: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepLabel: { fontSize: 14, color: COLORS.gray400, fontWeight: '500' },
  stepSub: { fontSize: 12, color: COLORS.gray400, marginTop: 1 },
  line: { width: 2, height: 24, marginLeft: 11, borderRadius: 1 },
});

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const loadOrder = useCallback(async () => {
    try {
      const res = await getOrderById(id);
      setOrder(res.data);
    } catch (err) {
      // Fallback: try from order list
      try {
        const res = await getMyOrders();
        const list = res.data?.items ?? res.data ?? [];
        const found = list.find(o => o.id === id);
        if (found) setOrder(found);
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadOrder(); }, [loadOrder]);

  const handleCancel = async () => {
    const confirmed = await alert.confirm({
      title: 'Cancel Order',
      message: 'Are you sure you want to cancel this order?',
      confirmText: 'Cancel Order',
      cancelText: 'Keep Order',
      type: 'danger',
    });
    
    if (confirmed) {
      setCancelling(true);
      try {
        await cancelOrder(id);
        loadOrder();
      } catch {
        alert.error({ title: 'Error', message: 'Could not cancel order.' });
      } finally {
        setCancelling(false);
      }
    }
  };

  if (loading) {
    return <GenericDetailSkeleton />;
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ fontSize: 48, marginBottom: 12 }}>📦</Text>
        <Text style={styles.errorText}>Order not found</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const canCancel = ['pending', 'confirmed'].includes(order.status);
  const statusColor = STATUS_COLORS[order.status] || COLORS.gray400;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Order ID Card */}
        <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: statusColor }]}>
          <View style={styles.orderIdRow}>
            <View>
              <Text style={styles.orderLabel}>ORDER ID</Text>
              <Text style={styles.orderId}>#{shortId(order.id)}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '1A', borderColor: statusColor + '44' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {STATUS_LABELS[order.status] || order.status}
              </Text>
            </View>
          </View>
          <Text style={styles.orderDate}>
            Placed on {order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
          </Text>
        </View>

        {/* Status Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Status</Text>
          <StatusTimeline currentStatus={order.status} />
        </View>

        {/* Shop Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Shop</Text>
          <View style={styles.shopRow}>
            <View style={styles.shopIcon}><Text style={{ fontSize: 20 }}>🏪</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.shopName}>{order.shop_name || 'Shop'}</Text>
              {order.shop_address && <Text style={styles.shopAddress}>{order.shop_address}</Text>}
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items ({items.length})</Text>
          {items.length === 0 ? (
            <Text style={styles.noItems}>No item details available</Text>
          ) : (
            items.map((item, idx) => {
              const qty = item.quantity ?? 1;
              const price = item.price ?? 0;
              const total = item.total ?? (price * qty);
              return (
                <View key={idx} style={[styles.itemRow, idx < items.length - 1 && styles.itemBorder]}>
                  <View style={styles.itemImage}>
                    {item.image_url || item.images?.[0] ? (
                      <Image source={{ uri: item.image_url || item.images[0] }} style={{ width: '100%', height: '100%', borderRadius: 8 }} />
                    ) : (
                      <Text style={{ fontSize: 22 }}>📦</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name || item.product_name || 'Item'}</Text>
                    <Text style={styles.itemMeta}>Qty: {qty} x {formatPrice(price)}</Text>
                  </View>
                  <Text style={styles.itemTotal}>{formatPrice(total)}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Price Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatPrice(order.subtotal ?? order.total_amount ?? 0)}</Text>
          </View>
          {order.delivery_fee > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Delivery Fee</Text>
              <Text style={styles.summaryValue}>{formatPrice(order.delivery_fee)}</Text>
            </View>
          )}
          {order.discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: COLORS.green }]}>Discount</Text>
              <Text style={[styles.summaryValue, { color: COLORS.green }]}>-{formatPrice(order.discount)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPrice(order.total_amount ?? order.total ?? 0)}</Text>
          </View>
          <View style={styles.paymentMethod}>
            <Text style={styles.paymentIcon}>💳</Text>
            <Text style={styles.paymentText}>{order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method || 'Payment'}</Text>
          </View>
        </View>

        {/* Delivery Info */}
        {order.delivery_type && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Delivery</Text>
            <View style={styles.deliveryRow}>
              <Text style={{ fontSize: 20 }}>{order.delivery_type === 'delivery' ? '🚚' : '🏪'}</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.deliveryType}>
                  {order.delivery_type === 'delivery' ? 'Home Delivery' : 'Store Pickup'}
                </Text>
                {order.delivery_address && <Text style={styles.deliveryAddress}>{order.delivery_address}</Text>}
              </View>
            </View>
          </View>
        )}

        {/* Actions */}
        {canCancel && (
          <TouchableOpacity
            style={styles.cancelOrderBtn}
            onPress={handleCancel}
            disabled={cancelling}
            activeOpacity={0.7}
          >
            {cancelling ? (
              <ActivityIndicator color={COLORS.red} />
            ) : (
              <Text style={styles.cancelOrderText}>Cancel Order</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Track Order */}
        {['confirmed', 'preparing', 'ready'].includes(order.status) && (
          <TouchableOpacity
            style={styles.trackBtn}
            onPress={() => router.push(`/(customer)/order-tracking/${order.id}`)}
            activeOpacity={0.8}
          >
            <Text style={styles.trackBtnText}>📍 Track Order</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg, gap: 12 },
  errorText: { fontSize: 16, color: COLORS.gray600 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '600' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray100,
  },
  backBtn: { width: 36, alignItems: 'center' },
  backArrow: { fontSize: 32, color: COLORS.gray700, lineHeight: 36, marginTop: -2 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.gray900 },

  content: { padding: 16, paddingBottom: 32 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16,
    marginBottom: 12, ...SHADOWS.card,
  },
  cardTitle: {
    fontSize: 14, fontWeight: '700', color: COLORS.gray400,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14,
  },

  orderIdRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
  },
  orderLabel: { fontSize: 11, color: COLORS.gray400, fontWeight: '600', letterSpacing: 0.8 },
  orderId: { fontSize: 20, fontWeight: '800', color: COLORS.gray900, fontFamily: 'monospace', marginTop: 2 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statusText: { fontSize: 12, fontWeight: '700' },
  orderDate: { fontSize: 13, color: COLORS.gray500 },

  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shopIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
  shopName: { fontSize: 15, fontWeight: '700', color: COLORS.gray900 },
  shopAddress: { fontSize: 13, color: COLORS.gray500, marginTop: 2 },

  noItems: { fontSize: 14, color: COLORS.gray400, textAlign: 'center', paddingVertical: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  itemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  itemImage: {
    width: 52, height: 52, borderRadius: 10, backgroundColor: COLORS.gray100,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.gray800, marginBottom: 3 },
  itemMeta: { fontSize: 12, color: COLORS.gray500 },
  itemTotal: { fontSize: 15, fontWeight: '700', color: COLORS.gray900 },

  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
  },
  summaryLabel: { fontSize: 14, color: COLORS.gray500 },
  summaryValue: { fontSize: 14, fontWeight: '600', color: COLORS.gray700 },
  totalRow: {
    borderTopWidth: 1, borderTopColor: COLORS.gray200, marginTop: 6, paddingTop: 12,
  },
  totalLabel: { fontSize: 16, fontWeight: '700', color: COLORS.gray900 },
  totalValue: { fontSize: 18, fontWeight: '800', color: COLORS.gray900 },
  paymentMethod: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 12, backgroundColor: COLORS.gray50, borderRadius: 10, padding: 10,
  },
  paymentIcon: { fontSize: 18 },
  paymentText: { fontSize: 13, fontWeight: '600', color: COLORS.gray600 },

  deliveryRow: { flexDirection: 'row', alignItems: 'center' },
  deliveryType: { fontSize: 15, fontWeight: '600', color: COLORS.gray800 },
  deliveryAddress: { fontSize: 13, color: COLORS.gray500, marginTop: 2 },

  cancelOrderBtn: {
    borderWidth: 1.5, borderColor: COLORS.red, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginBottom: 10,
    backgroundColor: COLORS.redLight,
  },
  cancelOrderText: { fontSize: 15, fontWeight: '700', color: COLORS.red },

  trackBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  trackBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
});
