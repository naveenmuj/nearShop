import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Modal,
  BackHandler,
} from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import useCartStore from '../../store/cartStore';
import {
  createOrder,
  createPaymentOrder,
  confirmPayment,
  cancelOrder,
  getMyOrders,
} from '../../lib/orders';
import { useCoupon as consumeCoupon } from '../../lib/deals';
import { trackEvent } from '../../lib/analytics';
import { recordLocalTelemetry } from '../../lib/localTelemetry';
import { alert } from '../../components/ui/PremiumAlert';
import { toast } from '../../components/ui/Toast';
import { listPaymentMethods, getDefaultPaymentMethod, applyPaymentMethodToOrder } from '../../lib/savedData';
import { COLORS, SHADOWS } from '../../constants/theme';

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');

function shortId(id) {
  if (!id) return '---';
  return String(id).replace(/-/g, '').slice(-8).toUpperCase();
}

function parseFloatSafe(v, fallback = 0) {
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseIntSafe(v, fallback = 0) {
  const parsed = parseInt(v, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePaymentStatus(order) {
  if (order?.payment_status) return String(order.payment_status).toLowerCase();
  if (order?.status === 'cancelled') return 'failed';
  if (order?.status === 'completed') return 'paid';
  if (order?.payment_method === 'cod') return 'pending';
  return 'pending';
}

function paymentStatusColor(status) {
  switch (status) {
    case 'paid':
      return '#16A34A';
    case 'failed':
      return '#DC2626';
    case 'refunded':
      return '#F59E0B';
    default:
      return '#2563EB';
  }
}

function formatPaymentMethodLabel(method) {
  if (!method) return 'No saved method';
  if (method.type === 'card') {
    return `${method.card_brand?.toUpperCase() || 'CARD'} •••• ${method.card_last4 || '----'}`;
  }
  if (method.type === 'upi') {
    return method.upi_id || 'Saved UPI';
  }
  if (method.type === 'wallet') {
    return method.wallet_id ? `Wallet • ${method.wallet_id}` : 'Saved Wallet';
  }
  return 'Saved payment method';
}

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const { getShopGroups, getSubtotal, clearShopItems } = useCartStore();
  const shopGroups = getShopGroups();
  const grandSubtotal = getSubtotal();

  const deliveryType = params.deliveryType === 'delivery' ? 'delivery' : 'pickup';
  const deliveryAddress = String(params.address || '').trim();
  const notes = String(params.notes || '').trim();
  const couponCode = String(params.couponCode || '').trim();
  const appliedCouponId = String(params.appliedCouponId || '').trim();
  const couponDiscount = parseFloatSafe(params.couponDiscount, 0);
  const coinsToUse = parseIntSafe(params.coinsToUse, 0);
  const coinDiscount = parseFloatSafe(params.coinDiscount, 0);

  const [paymentMethod, setPaymentMethod] = useState('online');
  const [loading, setLoading] = useState(false);
  const [retryingOrderId, setRetryingOrderId] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderCount, setOrderCount] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState([]);
  const [savedMethodsLoading, setSavedMethodsLoading] = useState(true);
  const [savedMethods, setSavedMethods] = useState([]);
  const [defaultSavedMethod, setDefaultSavedMethod] = useState(null);
  const [selectedSavedMethodId, setSelectedSavedMethodId] = useState(null);
  const [receiptData, setReceiptData] = useState({ orderIds: [], paymentRef: '', createdAt: '' });

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await getMyOrders();
      const rows = Array.isArray(res?.data) ? res.data : (res?.data?.items || res?.data?.orders || []);
      const sorted = [...rows].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      setRecentOrders(sorted.slice(0, 6));
    } catch {
      setRecentOrders([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const fetchSavedMethods = useCallback(async () => {
    setSavedMethodsLoading(true);
    try {
      const [methodsRes, defaultRes] = await Promise.all([
        listPaymentMethods(0, 20).catch(() => null),
        getDefaultPaymentMethod().catch(() => null),
      ]);
      const data = methodsRes?.data || {};
      const methods = Array.isArray(data) ? data : (Array.isArray(data.methods) ? data.methods : data.items || []);
      setSavedMethods(methods);
      const defaultMethod = defaultRes?.data || methods.find((item) => item.is_default) || null;
      setDefaultSavedMethod(defaultMethod);
      setSelectedSavedMethodId(defaultMethod?.id || null);
      if (defaultMethod?.type && defaultMethod.type !== 'wallet') {
        setPaymentMethod('online');
      }
    } catch {
      setSavedMethods([]);
      setDefaultSavedMethod(null);
      setSelectedSavedMethodId(null);
    } finally {
      setSavedMethodsLoading(false);
    }
  }, []);

  const grandTotal = useMemo(
    () => Math.max(0, grandSubtotal - couponDiscount - coinDiscount),
    [grandSubtotal, couponDiscount, coinDiscount],
  );

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => handler.remove();
  }, [router]);

  useEffect(() => {
    fetchHistory();
    fetchSavedMethods();
  }, [fetchHistory, fetchSavedMethods]);

  const handlePlaceOrder = async () => {
    if (shopGroups.length === 0) {
      alert.warning({ title: 'Cart is empty', message: 'Please add items before payment.' });
      return;
    }

    if (deliveryType === 'delivery' && !deliveryAddress) {
      alert.warning({ title: 'Address missing', message: 'Please add a delivery address before paying.' });
      return;
    }

    setLoading(true);
    const createdOrderIds = [];
    let latestPaymentRef = '';

    try {
      let successCount = 0;

      for (const group of shopGroups) {
        const payload = {
          shop_id: group.shop_id,
          items: group.items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            price: i.price,
            ranking_context: i.ranking_context || null,
          })),
          delivery_type: deliveryType,
          payment_method: paymentMethod === 'online' ? 'razorpay' : 'cod',
          ...(deliveryType === 'delivery' ? { delivery_address: deliveryAddress } : {}),
          ...(notes ? { notes } : {}),
          ...(coinsToUse > 0 ? { coins_used: coinsToUse, coin_discount: coinDiscount } : {}),
        };

        const { data: orderData } = await createOrder(payload);
        createdOrderIds.push(orderData.id);

        if (paymentMethod === 'online' && selectedSavedMethodId) {
          try {
            await applyPaymentMethodToOrder(orderData.id, selectedSavedMethodId);
          } catch {
            // Non-blocking; fallback to gateway default selection.
          }
        }

        if (paymentMethod === 'online') {
          try {
            const { data: paymentOrder } = await createPaymentOrder(orderData.id);

            if (paymentOrder?.test_mode) {
              latestPaymentRef = paymentOrder.test_payment_id || paymentOrder.razorpay_order_id || latestPaymentRef;
              await confirmPayment({
                order_id: orderData.id,
                razorpay_order_id: paymentOrder.razorpay_order_id,
                razorpay_payment_id: paymentOrder.test_payment_id,
                razorpay_signature: paymentOrder.test_signature || 'test_signature',
              });
            } else {
              const paymentResult = await RazorpayCheckout.open({
                key: paymentOrder.razorpay_key_id,
                amount: String(paymentOrder.amount),
                currency: paymentOrder.currency || 'INR',
                order_id: paymentOrder.razorpay_order_id,
                name: 'NearShop',
                description: `Order ${paymentOrder.order_number}`,
                prefill: { name: 'NearShop customer' },
                theme: { color: '#7F77DD' },
              });

              latestPaymentRef = paymentResult.razorpay_payment_id || paymentOrder.razorpay_order_id || latestPaymentRef;

              await confirmPayment({
                order_id: orderData.id,
                razorpay_order_id: paymentResult.razorpay_order_id || paymentOrder.razorpay_order_id,
                razorpay_payment_id: paymentResult.razorpay_payment_id,
                razorpay_signature: paymentResult.razorpay_signature,
              });
            }

            recordLocalTelemetry({
              type: 'mutation',
              name: paymentOrder?.test_mode ? 'checkout_test_payment' : 'checkout_live_payment',
              outcome: 'success',
              meta: { orderId: orderData.id, testMode: Boolean(paymentOrder?.test_mode) },
            }).catch(() => {});

            trackEvent({
              event_type: paymentOrder?.test_mode ? 'checkout_payment_test_success' : 'checkout_payment_success',
              entity_type: 'order',
              entity_id: orderData.id,
              metadata: {
                payment_method: 'online',
                mode: paymentOrder?.test_mode ? 'test' : 'live',
              },
            }).catch(() => {});
          } catch (paymentErr) {
            const cancelledByUser = String(paymentErr?.code || paymentErr?.description || '').toLowerCase().includes('cancel');
            try {
              await cancelOrder(orderData.id, 'payment_not_completed');
            } catch {}

            recordLocalTelemetry({
              type: 'mutation',
              name: cancelledByUser ? 'checkout_live_payment' : 'checkout_payment_failure',
              outcome: cancelledByUser ? 'cancelled' : 'failure',
              meta: { orderId: orderData.id },
            }).catch(() => {});

            trackEvent({
              event_type: cancelledByUser ? 'checkout_payment_cancelled' : 'checkout_payment_failed',
              entity_type: 'order',
              entity_id: orderData.id,
              metadata: {
                payment_method: 'online',
                error: paymentErr?.message || paymentErr?.description || 'unknown',
              },
            }).catch(() => {});

            throw paymentErr;
          }
        }

        clearShopItems(group.shop_id);
        successCount += 1;
      }

      if (appliedCouponId && createdOrderIds.length > 0) {
        try {
          await consumeCoupon(appliedCouponId, createdOrderIds[0], couponDiscount);
        } catch {
          alert.warning({
            title: 'Note',
            message: 'Order placed successfully, but coupon tracking may need support validation.',
          });
        }
      }

      setOrderCount(successCount);
      setReceiptData({
        orderIds: createdOrderIds,
        paymentRef: latestPaymentRef,
        createdAt: new Date().toISOString(),
      });
      setShowSuccess(true);
      await fetchHistory();
      toast.show({ type: 'order', text1: `${successCount} order${successCount > 1 ? 's' : ''} placed!` });
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : 'Failed to complete payment. Please try again.';
      alert.error({ title: 'Payment Failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleRetryPayment = async (order) => {
    if (!order?.id || retryingOrderId) return;

    setRetryingOrderId(order.id);
    try {
      const { data: paymentOrder } = await createPaymentOrder(order.id);

      if (paymentOrder?.test_mode) {
        await confirmPayment({
          order_id: order.id,
          razorpay_order_id: paymentOrder.razorpay_order_id,
          razorpay_payment_id: paymentOrder.test_payment_id,
          razorpay_signature: paymentOrder.test_signature || 'test_signature',
        });
      } else {
        const paymentResult = await RazorpayCheckout.open({
          key: paymentOrder.razorpay_key_id,
          amount: String(paymentOrder.amount),
          currency: paymentOrder.currency || 'INR',
          order_id: paymentOrder.razorpay_order_id,
          name: 'NearShop',
          description: `Order ${paymentOrder.order_number || shortId(order.id)}`,
          prefill: { name: 'NearShop customer' },
          theme: { color: '#7F77DD' },
        });

        await confirmPayment({
          order_id: order.id,
          razorpay_order_id: paymentResult.razorpay_order_id || paymentOrder.razorpay_order_id,
          razorpay_payment_id: paymentResult.razorpay_payment_id,
          razorpay_signature: paymentResult.razorpay_signature,
        });
      }

      await fetchHistory();
      toast.show({ type: 'success', text1: 'Payment completed successfully' });
    } catch (err) {
      const cancelledByUser = String(err?.code || err?.description || '').toLowerCase().includes('cancel');
      if (!cancelledByUser) {
        try {
          await cancelOrder(order.id, 'payment_not_completed');
        } catch {}
      }
      alert.error({
        title: cancelledByUser ? 'Payment cancelled' : 'Payment failed',
        message: cancelledByUser ? 'You can retry payment anytime from this screen.' : 'Please try again from your payment history.',
      });
    } finally {
      setRetryingOrderId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <TouchableOpacity onPress={() => router.push('/(customer)/orders')}>
          <Text style={styles.historyLink}>Orders</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.sectionTitle}>Paying For</Text>
          <Text style={styles.sectionSub}>{shopGroups.length} shop order{shopGroups.length > 1 ? 's' : ''}</Text>

          {shopGroups.length > 1 && (
            <View style={styles.multiShopBanner}>
              <Text style={styles.multiShopBannerText}>
                This cart will be split into separate shop orders, each tracked independently.
              </Text>
            </View>
          )}

          {shopGroups.map((group) => (
            <View key={group.shop_id} style={styles.shopBlock}>
              <View style={styles.shopBlockHeader}>
                <Text style={styles.shopBlockTitle}>{group.shop_name || 'Shop'}</Text>
                <Text style={styles.shopBlockTotal}>{formatPrice(group.subtotal || 0)}</Text>
              </View>
              {group.items.map((item) => (
                <View key={item.product_id} style={styles.shopItemRow}>
                  <Text style={styles.shopItemQty}>{item.quantity}x</Text>
                  <Text style={styles.shopItemName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.shopItemTotal}>{formatPrice((item.price || 0) * (item.quantity || 0))}</Text>
                </View>
              ))}
            </View>
          ))}

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Subtotal</Text>
            <Text style={styles.amountValue}>{formatPrice(grandSubtotal)}</Text>
          </View>

          {couponDiscount > 0 && (
            <View style={styles.amountRow}>
              <Text style={styles.discountLabel}>Coupon ({couponCode || 'Applied'})</Text>
              <Text style={styles.discountValue}>- {formatPrice(couponDiscount)}</Text>
            </View>
          )}

          {coinDiscount > 0 && (
            <View style={styles.amountRow}>
              <Text style={styles.discountLabel}>Wallet Coins ({coinsToUse})</Text>
              <Text style={styles.discountValue}>- {formatPrice(coinDiscount)}</Text>
            </View>
          )}

          <View style={styles.divider} />
          <View style={styles.amountRow}>
            <Text style={styles.totalLabel}>Total Payable</Text>
            <Text style={styles.totalValue}>{formatPrice(grandTotal)}</Text>
          </View>

          <Text style={styles.deliveryHint}>
            {deliveryType === 'delivery' ? `Delivery to: ${deliveryAddress || 'Address unavailable'}` : 'Pickup order'}
          </Text>
        </View>

        <View style={[styles.card, SHADOWS.card]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Choose Payment Method</Text>
            <TouchableOpacity onPress={() => router.push('/(customer)/payment-methods')}>
              <Text style={styles.manageLink}>Manage</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.savedMethodCard}>
            <Text style={styles.savedMethodLabel}>Saved method</Text>
            {savedMethodsLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <>
                <Text style={styles.savedMethodValue}>{formatPaymentMethodLabel(defaultSavedMethod)}</Text>
                <Text style={styles.savedMethodHint}>
                  {defaultSavedMethod ? 'Preferred for quicker checkout.' : 'Add a card or UPI to make payment faster.'}
                </Text>
              </>
            )}
          </View>

          {!savedMethodsLoading && savedMethods.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.methodPickerRow}>
              {savedMethods.map((method) => {
                const selected = selectedSavedMethodId === method.id;
                return (
                  <TouchableOpacity
                    key={method.id}
                    style={[styles.methodPickerChip, selected && styles.methodPickerChipActive]}
                    onPress={() => {
                      setSelectedSavedMethodId(method.id);
                      if (method.type !== 'wallet') {
                        setPaymentMethod('online');
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.methodPickerChipText, selected && styles.methodPickerChipTextActive]}>
                      {method.is_default ? '★ ' : ''}{formatPaymentMethodLabel(method)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[styles.methodBtn, paymentMethod === 'online' && styles.methodBtnActive]}
            onPress={() => setPaymentMethod('online')}
            activeOpacity={0.85}
          >
            <Text style={styles.methodEmoji}>💳</Text>
            <View style={styles.methodInfo}>
              <Text style={styles.methodTitle}>Pay Online</Text>
              <Text style={styles.methodDesc}>UPI / Card / Netbanking via Razorpay</Text>
            </View>
            {paymentMethod === 'online' && <Text style={styles.methodCheck}>✓</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.methodBtn, paymentMethod === 'cod' && styles.methodBtnActive]}
            onPress={() => setPaymentMethod('cod')}
            activeOpacity={0.85}
          >
            <Text style={styles.methodEmoji}>💵</Text>
            <View style={styles.methodInfo}>
              <Text style={styles.methodTitle}>Cash on Delivery</Text>
              <Text style={styles.methodDesc}>Pay when your order is delivered</Text>
            </View>
            {paymentMethod === 'cod' && <Text style={styles.methodCheck}>✓</Text>}
          </TouchableOpacity>
        </View>

        <View style={[styles.card, SHADOWS.card]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Order & Payment History</Text>
            <TouchableOpacity onPress={() => router.push('/(customer)/orders')}>
              <Text style={styles.manageLink}>View All</Text>
            </TouchableOpacity>
          </View>

          {historyLoading ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : recentOrders.length === 0 ? (
            <Text style={styles.emptyHistory}>No past orders yet. Your payments will appear here.</Text>
          ) : (
            recentOrders.map((order) => {
              const pStatus = normalizePaymentStatus(order);
              const pColor = paymentStatusColor(pStatus);
                const canRetry = pStatus !== 'paid' && String(order.payment_method || '').toLowerCase() !== 'cod';
              return (
                <View key={order.id} style={styles.historyRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.historyId}>Order #{shortId(order.id)}</Text>
                    <Text style={styles.historyMeta}>
                      {new Date(order.created_at || Date.now()).toLocaleDateString('en-IN')} • {formatPrice(order.total_amount || 0)}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {String(order.payment_method || 'unknown').toUpperCase()}
                    </Text>
                      {canRetry && (
                        <TouchableOpacity
                          style={styles.retryLink}
                          onPress={() => handleRetryPayment(order)}
                          disabled={retryingOrderId === order.id}
                        >
                          <Text style={styles.retryLinkText}>
                            {retryingOrderId === order.id ? 'Retrying...' : 'Retry Payment'}
                          </Text>
                        </TouchableOpacity>
                      )}
                  </View>
                  <View style={[styles.statusPill, { borderColor: pColor + '55', backgroundColor: pColor + '1A' }]}>
                    <Text style={[styles.statusPillText, { color: pColor }]}>{pStatus.toUpperCase()}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.payBtn} onPress={handlePlaceOrder} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.payBtnText}>
              {paymentMethod === 'online' ? 'Pay & Place Order' : 'Place Order'} — {formatPrice(grandTotal)}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Text style={styles.successEmoji}>✅</Text>
            <Text style={styles.successTitle}>Payment Successful</Text>
            <Text style={styles.successSub}>
              {orderCount > 1
                ? `${orderCount} orders placed successfully`
                : 'Your order has been placed successfully'}
            </Text>
            <TouchableOpacity
              style={styles.successPrimaryBtn}
              onPress={() => {
                setShowSuccess(false);
                router.replace({
                  pathname: '/(customer)/payment-receipt',
                  params: {
                    orderIds: receiptData.orderIds.join(','),
                    paymentMethod,
                    paymentRef: receiptData.paymentRef || '',
                    amount: String(grandTotal),
                    createdAt: receiptData.createdAt || new Date().toISOString(),
                    deliveryType,
                  },
                });
              }}
            >
              <Text style={styles.successPrimaryText}>View Receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.successSecondaryBtn}
              onPress={() => {
                setShowSuccess(false);
                router.replace('/(customer)/home');
              }}
            >
              <Text style={styles.successSecondaryText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  historyLink: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  content: { padding: 16 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.gray900 },
  sectionSub: { fontSize: 12, color: COLORS.gray500, marginTop: 4, marginBottom: 10 },
  multiShopBanner: { backgroundColor: '#EEF2FF', borderRadius: 12, padding: 12, marginBottom: 12 },
  multiShopBannerText: { color: '#4338CA', fontSize: 12, fontWeight: '600', lineHeight: 18 },
  shopBlock: { borderWidth: 1, borderColor: COLORS.gray100, borderRadius: 14, padding: 12, marginBottom: 12, backgroundColor: '#FAFAFB' },
  shopBlockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  shopBlockTitle: { fontSize: 13, fontWeight: '700', color: COLORS.gray900, flex: 1, marginRight: 8 },
  shopBlockTotal: { fontSize: 13, fontWeight: '800', color: COLORS.gray900 },
  shopItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  shopItemQty: { width: 28, fontSize: 12, fontWeight: '700', color: COLORS.gray500 },
  shopItemName: { flex: 1, fontSize: 12, color: COLORS.gray700, marginRight: 8 },
  shopItemTotal: { fontSize: 12, fontWeight: '700', color: COLORS.gray900 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  amountLabel: { fontSize: 13, color: COLORS.gray600 },
  amountValue: { fontSize: 14, fontWeight: '600', color: COLORS.gray900 },
  discountLabel: { fontSize: 13, color: '#059669' },
  discountValue: { fontSize: 14, fontWeight: '700', color: '#059669' },
  divider: { height: 1, backgroundColor: COLORS.gray100, marginVertical: 10 },
  totalLabel: { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
  totalValue: { fontSize: 22, fontWeight: '800', color: COLORS.gray900 },
  deliveryHint: { marginTop: 10, fontSize: 12, color: COLORS.gray500 },
  manageLink: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  savedMethodCard: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: COLORS.gray100, marginBottom: 10 },
  savedMethodLabel: { fontSize: 11, fontWeight: '700', color: COLORS.gray500, textTransform: 'uppercase', letterSpacing: 0.4 },
  savedMethodValue: { marginTop: 4, fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
  savedMethodHint: { marginTop: 4, fontSize: 12, color: COLORS.gray500, lineHeight: 17 },
  methodPickerRow: { paddingBottom: 2 },
  methodPickerChip: {
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: COLORS.white,
  },
  methodPickerChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#F3F0FF',
  },
  methodPickerChipText: { fontSize: 12, color: COLORS.gray700, fontWeight: '600' },
  methodPickerChipTextActive: { color: COLORS.primary, fontWeight: '700' },
  methodBtn: {
    borderWidth: 1,
    borderColor: COLORS.gray200,
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodBtnActive: { borderColor: COLORS.primary, backgroundColor: '#F3F0FF' },
  methodEmoji: { fontSize: 18 },
  methodInfo: { flex: 1, marginLeft: 10 },
  methodTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
  methodDesc: { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  methodCheck: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  emptyHistory: { fontSize: 13, color: COLORS.gray500, marginTop: 4 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  historyId: { fontSize: 13, fontWeight: '700', color: COLORS.gray900 },
  historyMeta: { fontSize: 12, color: COLORS.gray500, marginTop: 2 },
  retryLink: { marginTop: 6, alignSelf: 'flex-start' },
  retryLinkText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray100,
    padding: 16,
    paddingBottom: 30,
  },
  payBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  payBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  successCard: { backgroundColor: COLORS.white, borderRadius: 24, padding: 30, alignItems: 'center', width: '100%', maxWidth: 340 },
  successEmoji: { fontSize: 52, marginBottom: 10 },
  successTitle: { fontSize: 22, fontWeight: '800', color: COLORS.gray900, marginBottom: 8 },
  successSub: { fontSize: 14, color: COLORS.gray600, textAlign: 'center', marginBottom: 20 },
  successPrimaryBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 13, width: '100%', alignItems: 'center', marginBottom: 8 },
  successPrimaryText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  successSecondaryBtn: { paddingVertical: 8 },
  successSecondaryText: { color: COLORS.gray500, fontWeight: '600', fontSize: 14 },
});
