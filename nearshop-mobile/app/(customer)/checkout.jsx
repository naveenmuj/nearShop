import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, StatusBar, Modal, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import useCartStore from '../../store/cartStore';
import useLocationStore from '../../store/locationStore';
import { createOrder } from '../../lib/orders';
import { toast } from '../../components/ui/Toast';
import { COLORS, SHADOWS } from '../../constants/theme';

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');

export default function CheckoutScreen() {
  const router = useRouter();
  const { getShopGroups, getSubtotal, clearShopItems, clearCart } = useCartStore();
  const shopGroups = getShopGroups();
  const grandTotal = getSubtotal();

  const { address: locationAddress } = useLocationStore();
  const [deliveryType, setDeliveryType] = useState('pickup');
  const [address, setAddress] = useState(locationAddress || '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderCount, setOrderCount] = useState(0);

  const handlePlaceOrder = async () => {
    if (deliveryType === 'delivery' && !address.trim()) {
      Alert.alert('Error', 'Please enter your delivery address');
      return;
    }
    setLoading(true);
    try {
      let successCount = 0;
      for (const group of shopGroups) {
        const payload = {
          shop_id: group.shop_id,
          items: group.items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
          })),
          delivery_type: deliveryType,
          payment_method: 'cod',
          ...(deliveryType === 'delivery' ? { delivery_address: address.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        };
        await createOrder(payload);
        clearShopItems(group.shop_id);
        successCount++;
      }
      setOrderCount(successCount);
      setShowSuccess(true);
      toast.show({ type: 'order', text1: `${successCount} order${successCount > 1 ? 's' : ''} placed!` });
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : 'Failed to place order. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  if (shopGroups.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>No items to checkout</Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => router.navigate('/(customer)/home')}>
            <Text style={styles.shopBtnText}>Browse Products</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Summary */}
        {shopGroups.map((group) => (
          <View key={group.shop_id} style={[styles.card, SHADOWS.card]}>
            <Text style={styles.shopName}>🏪 {group.shop_name}</Text>
            {group.items.map((item) => (
              <View key={item.product_id} style={styles.itemRow}>
                <Text style={styles.itemQty}>{item.quantity}x</Text>
                <Text style={styles.itemNameText} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemTotal}>{formatPrice(item.price * item.quantity)}</Text>
              </View>
            ))}
            <View style={styles.subtotalRow}>
              <Text style={styles.subtotalLabel}>Subtotal</Text>
              <Text style={styles.subtotalValue}>{formatPrice(group.subtotal)}</Text>
            </View>
          </View>
        ))}

        {/* Delivery Type */}
        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.sectionTitle}>Delivery Method</Text>
          <View style={styles.toggleRow}>
            {['pickup', 'delivery'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.toggleBtn, deliveryType === type && styles.toggleBtnActive]}
                onPress={() => setDeliveryType(type)}
              >
                <Text style={[styles.toggleText, deliveryType === type && styles.toggleTextActive]}>
                  {type === 'pickup' ? '🏪 Pickup' : '🚚 Delivery'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {deliveryType === 'delivery' && (
            <TextInput
              style={styles.textInput}
              placeholder="Enter delivery address"
              placeholderTextColor={COLORS.gray400}
              value={address}
              onChangeText={setAddress}
              multiline
            />
          )}
        </View>

        {/* Notes */}
        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.sectionTitle}>Order Notes (optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Any special instructions..."
            placeholderTextColor={COLORS.gray400}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        {/* Payment */}
        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={[styles.toggleBtn, styles.toggleBtnActive, { alignSelf: 'flex-start' }]}>
            <Text style={[styles.toggleText, styles.toggleTextActive]}>💵 Cash on Delivery</Text>
          </View>
        </View>

        {/* Grand Total */}
        <View style={[styles.totalCard, SHADOWS.card]}>
          <Text style={styles.grandTotalLabel}>Grand Total</Text>
          <Text style={styles.grandTotalValue}>{formatPrice(grandTotal)}</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Place Order button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.placeOrderBtn} onPress={handlePlaceOrder} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.placeOrderBtnText}>Place Order — {formatPrice(grandTotal)}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Text style={styles.successEmoji}>🎉</Text>
            <Text style={styles.successTitle}>Order Placed!</Text>
            <Text style={styles.successSub}>
              {orderCount > 1
                ? `${orderCount} orders have been sent to the shops`
                : 'Your order has been sent to the shop'}
            </Text>
            <Text style={styles.successHint}>You'll be notified when it's ready</Text>
            <TouchableOpacity
              style={styles.successPrimaryBtn}
              onPress={() => { setShowSuccess(false); router.replace('/(customer)/orders'); }}
            >
              <Text style={styles.successPrimaryText}>📦 View My Orders</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.successSecondaryBtn}
              onPress={() => { setShowSuccess(false); router.replace('/(customer)/home'); }}
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
  safe: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  backArrow: { fontSize: 32, color: COLORS.gray700, lineHeight: 36 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.gray900 },
  content: { padding: 16 },
  card: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, marginBottom: 12 },
  shopName: { fontSize: 15, fontWeight: '700', color: COLORS.gray900, marginBottom: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  itemQty: { fontSize: 13, fontWeight: '600', color: COLORS.gray500, width: 30 },
  itemNameText: { flex: 1, fontSize: 13, color: COLORS.gray700, marginRight: 8 },
  itemTotal: { fontSize: 13, fontWeight: '700', color: COLORS.gray900 },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: COLORS.gray100, paddingTop: 10, marginTop: 8 },
  subtotalLabel: { fontSize: 13, color: COLORS.gray500 },
  subtotalValue: { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray900, marginBottom: 10 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 2, borderColor: COLORS.gray200 || '#E5E7EB' },
  toggleBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight || '#F0E6FF' },
  toggleText: { fontSize: 13, fontWeight: '600', color: COLORS.gray500 },
  toggleTextActive: { color: COLORS.primary },
  textInput: { borderWidth: 1, borderColor: COLORS.gray200 || '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.gray900, marginTop: 10, minHeight: 60, textAlignVertical: 'top' },
  totalCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grandTotalLabel: { fontSize: 16, fontWeight: '600', color: COLORS.gray700 },
  grandTotalValue: { fontSize: 24, fontWeight: '800', color: COLORS.gray900 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.gray100, padding: 16, paddingBottom: 32 },
  placeOrderBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  placeOrderBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.gray700, marginBottom: 24 },
  shopBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32 },
  shopBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  successOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  successCard: { backgroundColor: COLORS.white, borderRadius: 24, padding: 32, alignItems: 'center', width: '100%', maxWidth: 340 },
  successEmoji: { fontSize: 64, marginBottom: 12 },
  successTitle: { fontSize: 24, fontWeight: '800', color: COLORS.gray900, marginBottom: 8 },
  successSub: { fontSize: 15, color: COLORS.gray600, textAlign: 'center', lineHeight: 22, marginBottom: 4 },
  successHint: { fontSize: 13, color: COLORS.gray400, textAlign: 'center', marginBottom: 24 },
  successPrimaryBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center', marginBottom: 10 },
  successPrimaryText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
  successSecondaryBtn: { paddingVertical: 10 },
  successSecondaryText: { color: COLORS.gray500, fontWeight: '600', fontSize: 14 },
});
