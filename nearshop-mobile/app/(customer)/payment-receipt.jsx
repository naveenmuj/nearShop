import { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { getMyOrders } from '../../lib/orders';
import { COLORS, SHADOWS } from '../../constants/theme';

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');

function shortId(id) {
  if (!id) return '---';
  return String(id).replace(/-/g, '').slice(-8).toUpperCase();
}

export default function PaymentReceiptScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const orderIds = useMemo(
    () => String(params.orderIds || '').split(',').map((v) => v.trim()).filter(Boolean),
    [params.orderIds],
  );

  const paymentMethod = String(params.paymentMethod || 'online');
  const paymentRef = String(params.paymentRef || 'N/A');
  const amount = Number(params.amount || 0);
  const createdAt = String(params.createdAt || new Date().toISOString());
  const deliveryType = String(params.deliveryType || 'pickup');

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);

  const loadOrderDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyOrders();
      const rows = Array.isArray(res?.data) ? res.data : (res?.data?.items || res?.data?.orders || []);
      const filtered = rows.filter((order) => orderIds.includes(String(order.id)));
      setOrders(filtered);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [orderIds]);

  useEffect(() => {
    loadOrderDetails();
  }, [loadOrderDetails]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(customer)/orders');
      return true;
    });
    return () => handler.remove();
  }, [router]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(customer)/orders')}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment Receipt</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.successBanner, SHADOWS.card]}>
          <Text style={styles.successIcon}>✅</Text>
          <Text style={styles.successTitle}>Payment Completed</Text>
          <Text style={styles.successSub}>Your payment has been successfully processed.</Text>
        </View>

        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.cardTitle}>Transaction Details</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Transaction ID</Text>
            <Text style={styles.value}>{paymentRef}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Payment Method</Text>
            <Text style={styles.value}>{paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Delivery Type</Text>
            <Text style={styles.value}>{deliveryType === 'delivery' ? 'Home Delivery' : 'Store Pickup'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Date & Time</Text>
            <Text style={styles.value}>{new Date(createdAt).toLocaleString('en-IN')}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.totalLabel}>Amount Paid</Text>
            <Text style={styles.totalValue}>{formatPrice(amount)}</Text>
          </View>
        </View>

        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.cardTitle}>Order Details</Text>

          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : orders.length === 0 ? (
            <Text style={styles.emptyText}>Order details are syncing. You can always view them from My Orders.</Text>
          ) : (
            orders.map((order) => (
              <View key={order.id} style={styles.orderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderId}>Order #{shortId(order.id)}</Text>
                  <Text style={styles.orderMeta}>{order.shop_name || 'Shop'}</Text>
                  <Text style={styles.orderMeta}>{String(order.status || '').toUpperCase()}</Text>
                </View>
                <Text style={styles.orderTotal}>{formatPrice(order.total_amount || 0)}</Text>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace('/(customer)/orders')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>View My Orders</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace('/(customer)/home')}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryBtnText}>Continue Shopping</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
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
  backArrow: { fontSize: 30, color: COLORS.gray700, lineHeight: 34 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.gray900 },
  content: { padding: 16, paddingBottom: 40 },
  successBanner: { backgroundColor: COLORS.white, borderRadius: 18, padding: 20, alignItems: 'center', marginBottom: 12 },
  successIcon: { fontSize: 42 },
  successTitle: { marginTop: 8, fontSize: 20, fontWeight: '800', color: COLORS.gray900 },
  successSub: { marginTop: 4, fontSize: 13, color: COLORS.gray500, textAlign: 'center' },
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.gray900, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 6 },
  label: { fontSize: 13, color: COLORS.gray500, flex: 1, marginRight: 12 },
  value: { fontSize: 13, color: COLORS.gray900, fontWeight: '600', flex: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: COLORS.gray100, marginVertical: 8 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
  totalValue: { fontSize: 20, fontWeight: '800', color: COLORS.gray900 },
  emptyText: { fontSize: 12, color: COLORS.gray500 },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  orderId: { fontSize: 13, fontWeight: '700', color: COLORS.gray900 },
  orderMeta: { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  orderTotal: { fontSize: 13, fontWeight: '700', color: COLORS.gray900 },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  secondaryBtn: { alignItems: 'center', paddingVertical: 14 },
  secondaryBtnText: { color: COLORS.gray500, fontWeight: '600', fontSize: 14 },
});
