import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, StatusBar, Modal, Linking, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import useCartStore from '../../store/cartStore';
import useLocationStore from '../../store/locationStore';
import { createOrder, createPaymentOrder, confirmPayment } from '../../lib/orders';
import { validateCoupon, useCoupon } from '../../lib/deals';
import { listAddresses, createAddress } from '../../lib/auth';
import { getBalance } from '../../lib/loyalty';
import { toast } from '../../components/ui/Toast';
import { alert } from '../../components/ui/PremiumAlert';
import { COLORS, SHADOWS } from '../../constants/theme';

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');

export default function CheckoutScreen() {
  const router = useRouter();
  const { getShopGroups, getSubtotal, clearShopItems, clearCart } = useCartStore();
  const shopGroups = getShopGroups();
  const grandSubtotal = getSubtotal();

  const { address: locationAddress, latitude, longitude } = useLocationStore();
  const [deliveryType, setDeliveryType] = useState('pickup');
  const [address, setAddress] = useState(locationAddress || '');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [orderCount, setOrderCount] = useState(0);
  
  // Payment state
  const [paymentMethod, setPaymentMethod] = useState('cod');
  
  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  
  // Wallet state
  const [walletBalance, setWalletBalance] = useState(0);
  const [coinsToUse, setCoinsToUse] = useState(0);
  const [usingWallet, setUsingWallet] = useState(false);
  
  // Address state
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [newAddress, setNewAddress] = useState({ label: 'home', address_line1: '', city: '', pincode: '' });

  // Calculate total with coupon and wallet
  const coinDiscount = coinsToUse / 10; // 10 coins = ₹1
  const grandTotal = Math.max(0, grandSubtotal - couponDiscount - coinDiscount);

  // Load saved addresses and wallet balance
  useEffect(() => {
    const loadAddresses = async () => {
      try {
        const { data } = await listAddresses();
        setAddresses(data || []);
        const defaultAddr = data?.find(a => a.is_default);
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
          setAddress(defaultAddr.formatted_address);
        }
      } catch (err) {
        console.error('Failed to load addresses:', err);
      }
    };
    
    const loadWalletBalance = async () => {
      try {
        const res = await getBalance();
        setWalletBalance(res.data?.balance || 0);
      } catch (err) {
        console.error('Failed to load wallet balance:', err);
      }
    };
    
    loadAddresses();
    loadWalletBalance();
  }, []);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => handler.remove();
  }, []);

  // Handle coupon validation
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      alert.warning({ title: 'Error', message: 'Please enter a coupon code' });
      return;
    }
    
    setValidatingCoupon(true);
    try {
      const shopId = shopGroups.length === 1 ? shopGroups[0].shop_id : null;
      const { data } = await validateCoupon(couponCode, shopId, grandSubtotal);
      
      if (data.valid) {
        setAppliedCoupon(data.coupon);
        setCouponDiscount(data.discount_amount);
        toast.show({ type: 'success', text1: data.message });
      } else {
        alert.warning({ title: 'Invalid Coupon', message: data.message });
        setAppliedCoupon(null);
        setCouponDiscount(0);
      }
    } catch (err) {
      alert.error({ title: 'Error', message: err.response?.data?.detail || 'Failed to validate coupon' });
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setAppliedCoupon(null);
    setCouponDiscount(0);
  };

  // Save new address
  const handleSaveAddress = async () => {
    if (!newAddress.address_line1 || !newAddress.city || !newAddress.pincode) {
      alert.warning({ title: 'Error', message: 'Please fill in all required fields' });
      return;
    }
    
    try {
      const { data } = await createAddress({
        ...newAddress,
        latitude,
        longitude,
        is_default: addresses.length === 0,
      });
      setAddresses(prev => [...prev, data]);
      setSelectedAddressId(data.id);
      setAddress(data.formatted_address);
      setShowAddressModal(false);
      setNewAddress({ label: 'home', address_line1: '', city: '', pincode: '' });
      toast.show({ type: 'success', text1: 'Address saved!' });
    } catch (err) {
      alert.error({ title: 'Error', message: err.response?.data?.detail || 'Failed to save address' });
    }
  };

  const handlePlaceOrder = async () => {
    if (deliveryType === 'delivery' && !address.trim()) {
      alert.warning({ title: 'Error', message: 'Please enter your delivery address' });
      return;
    }
    setLoading(true);
    
    const createdOrderIds = []; // Track successfully created orders
    
    try {
      let successCount = 0;
      
      // Create all orders first
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
          ...(deliveryType === 'delivery' ? { delivery_address: address.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          // Wallet coins redemption
          ...(coinsToUse > 0 ? { coins_used: coinsToUse, coin_discount: coinDiscount } : {}),
        };
        
        const { data: orderData } = await createOrder(payload);
        createdOrderIds.push(orderData.id); // Track successful order
        
        // Online payment is disabled - only COD available
        // TODO: Implement Razorpay SDK for online payments
        
        clearShopItems(group.shop_id);
        successCount++;
      }
      
      // Only record coupon usage AFTER all orders succeed
      if (appliedCoupon && createdOrderIds.length > 0) {
        try {
          // Record coupon usage with first order ID
          await useCoupon(appliedCoupon.id, createdOrderIds[0], couponDiscount);
        } catch (e) {
          // Log but don't fail the order - backend should handle duplicate usage
          console.error('Failed to record coupon usage:', e);
          alert.warning({
            title: 'Note',
            message: 'Order placed successfully, but coupon tracking may have failed. Contact support if needed.'
          });
        }
      }
      
      setOrderCount(successCount);
      setShowSuccess(true);
      toast.show({ type: 'order', text1: `${successCount} order${successCount > 1 ? 's' : ''} placed!` });
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : 'Failed to place order. Please try again.';
      alert.error({ title: 'Error', message: msg });
      
      // Don't record coupon usage if order failed
      // Coupon remains available for next attempt
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
          <TouchableOpacity style={styles.shopBtn} onPress={() => router.back()}>
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

      <ScrollView 
        contentContainerStyle={styles.content} 
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
      >
        {/* Saved Addresses */}
        {deliveryType === 'delivery' && addresses.length > 0 && (
          <View style={[styles.card, SHADOWS.card]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📍 Delivery Address</Text>
              <TouchableOpacity onPress={() => setShowAddressModal(true)}>
                <Text style={styles.addLink}>+ Add New</Text>
              </TouchableOpacity>
            </View>
            {addresses.map((addr) => (
              <TouchableOpacity
                key={addr.id}
                style={[styles.addressItem, selectedAddressId === addr.id && styles.addressItemActive]}
                onPress={() => {
                  setSelectedAddressId(addr.id);
                  setAddress(addr.formatted_address);
                }}
              >
                <View style={[styles.radio, selectedAddressId === addr.id && styles.radioActive]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressLabel}>{addr.label.toUpperCase()}</Text>
                  <Text style={styles.addressText}>{addr.formatted_address}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

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

        {/* Coupon Section */}
        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.sectionTitle}>🏷️ Have a Coupon?</Text>
          {appliedCoupon ? (
            <View style={styles.appliedCoupon}>
              <View>
                <Text style={styles.couponCodeText}>{appliedCoupon.code}</Text>
                <Text style={styles.couponSaving}>You save {formatPrice(couponDiscount)}</Text>
              </View>
              <TouchableOpacity onPress={handleRemoveCoupon}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.couponRow}>
              <TextInput
                style={styles.couponInput}
                placeholder="Enter code"
                placeholderTextColor={COLORS.gray400}
                value={couponCode}
                onChangeText={(t) => setCouponCode(t.toUpperCase())}
                autoCapitalize="characters"
              />
              <TouchableOpacity 
                style={styles.applyBtn} 
                onPress={handleApplyCoupon}
                disabled={validatingCoupon}
              >
                {validatingCoupon ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.applyBtnText}>Apply</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Wallet Coins Section */}
        {walletBalance > 0 && (
          <View style={[styles.card, SHADOWS.card]}>
            <View style={styles.walletHeader}>
              <Text style={styles.sectionTitle}>🪙 Use Wallet Coins</Text>
              <TouchableOpacity
                onPress={() => setUsingWallet(!usingWallet)}
                activeOpacity={0.7}
              >
                <View style={[styles.walletToggle, usingWallet && styles.walletToggleActive]}>
                  <View style={[styles.walletToggleCircle, usingWallet && styles.walletToggleCircleActive]} />
                </View>
              </TouchableOpacity>
            </View>
            <Text style={styles.walletBalance}>Available: {walletBalance} coins</Text>
            
            {usingWallet && (
              <View style={styles.walletInputSection}>
                <View style={styles.coinsRow}>
                  <TextInput
                    style={styles.coinsInput}
                    value={String(coinsToUse)}
                    onChangeText={(text) => {
                      const value = parseInt(text) || 0;
                      const maxCoins = Math.min(walletBalance, Math.floor(grandSubtotal * 10)); // Can't use more than order value
                      setCoinsToUse(Math.min(value, maxCoins));
                    }}
                    placeholder="0"
                    placeholderTextColor={COLORS.gray400}
                    keyboardType="numeric"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={styles.maxBtn}
                    onPress={() => {
                      const maxCoins = Math.min(walletBalance, Math.floor(grandSubtotal * 10));
                      setCoinsToUse(maxCoins);
                    }}
                  >
                    <Text style={styles.maxBtnText}>MAX</Text>
                  </TouchableOpacity>
                </View>
                {coinsToUse > 0 && (
                  <View style={styles.coinsValueRow}>
                    <Text style={styles.coinsValueText}>
                      Using {coinsToUse} coins = {formatPrice(coinDiscount)} discount
                    </Text>
                    <Text style={styles.coinsNote}>10 coins = ₹1</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

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
          {deliveryType === 'delivery' && addresses.length === 0 && (
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

        {/* Payment Method */}
        <View style={[styles.card, SHADOWS.card]}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, paymentMethod === 'cod' && styles.toggleBtnActive]}
              onPress={() => setPaymentMethod('cod')}
            >
              <Text style={[styles.toggleText, paymentMethod === 'cod' && styles.toggleTextActive]}>
                💵 Cash on Delivery
              </Text>
            </TouchableOpacity>
            {/* Online payment temporarily disabled - Razorpay SDK implementation pending */}
            {false && (
              <TouchableOpacity
                style={[styles.toggleBtn, paymentMethod === 'online' && styles.toggleBtnActive, styles.toggleBtnDisabled]}
                onPress={() => setPaymentMethod('online')}
                disabled={true}
              >
                <Text style={[styles.toggleText, paymentMethod === 'online' && styles.toggleTextActive, styles.toggleTextDisabled]}>
                  💳 Pay Online
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.paymentNote}>
            💡 Online payment coming soon! Pay securely with Cash on Delivery for now.
          </Text>
        </View>

        {/* Grand Total */}
        <View style={[styles.totalCard, SHADOWS.card]}>
          <View>
            <Text style={styles.grandTotalLabel}>Subtotal</Text>
            <Text style={styles.subtotalAmount}>{formatPrice(grandSubtotal)}</Text>
            
            {couponDiscount > 0 && (
              <View style={styles.discountRow}>
                <Text style={styles.discountLabel}>Coupon Discount</Text>
                <Text style={styles.discountValue}>-{formatPrice(couponDiscount)}</Text>
              </View>
            )}
            
            {coinsToUse > 0 && (
              <View style={styles.discountRow}>
                <Text style={styles.discountLabel}>Wallet Coins ({coinsToUse} coins)</Text>
                <Text style={styles.discountValue}>-{formatPrice(coinDiscount)}</Text>
              </View>
            )}
            
            <View style={styles.totalDivider} />
            <View style={styles.finalTotalRow}>
              <Text style={styles.grandTotalLabel}>Total Amount</Text>
              <Text style={styles.grandTotalValue}>{formatPrice(grandTotal)}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Place Order button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.placeOrderBtn} onPress={handlePlaceOrder} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.placeOrderBtnText}>
              {paymentMethod === 'online' ? 'Pay & Place Order' : 'Place Order'} — {formatPrice(grandTotal)}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Add Address Modal */}
      <Modal visible={showAddressModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add New Address</Text>
            <View style={styles.labelRow}>
              {['home', 'work', 'other'].map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.labelChip, newAddress.label === l && styles.labelChipActive]}
                  onPress={() => setNewAddress(prev => ({ ...prev, label: l }))}
                >
                  <Text style={[styles.labelChipText, newAddress.label === l && styles.labelChipTextActive]}>
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Address Line 1 *"
              value={newAddress.address_line1}
              onChangeText={(t) => setNewAddress(prev => ({ ...prev, address_line1: t }))}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="City *"
              value={newAddress.city}
              onChangeText={(t) => setNewAddress(prev => ({ ...prev, city: t }))}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Pincode *"
              value={newAddress.pincode}
              onChangeText={(t) => setNewAddress(prev => ({ ...prev, pincode: t }))}
              keyboardType="numeric"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddressModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveAddress}>
                <Text style={styles.modalSaveText}>Save Address</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  addLink: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
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
  toggleTextDisabled: { color: COLORS.gray300 },
  toggleBtnDisabled: { opacity: 0.5 },
  paymentNote: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 12,
    lineHeight: 16,
  },
  textInput: { borderWidth: 1, borderColor: COLORS.gray200 || '#E5E7EB', borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.gray900, marginTop: 10, minHeight: 60, textAlignVertical: 'top' },
  // Coupon styles
  couponRow: { flexDirection: 'row', gap: 8 },
  couponInput: { flex: 1, borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 12, padding: 12, fontSize: 14 },
  applyBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' },
  applyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  appliedCoupon: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 12, padding: 12 },
  couponCodeText: { fontSize: 14, fontWeight: '700', color: '#047857' },
  couponSaving: { fontSize: 12, color: '#059669', marginTop: 2 },
  removeText: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
  // Wallet styles
  walletHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  walletBalance: { fontSize: 13, color: COLORS.gray600, marginBottom: 12 },
  walletToggle: { 
    width: 50, height: 28, borderRadius: 14, backgroundColor: COLORS.gray200, 
    padding: 2, flexDirection: 'row', alignItems: 'center',
  },
  walletToggleActive: { backgroundColor: COLORS.primary },
  walletToggleCircle: { 
    width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 1, elevation: 2,
  },
  walletToggleCircleActive: { marginLeft: 22 },
  walletInputSection: { marginTop: 8 },
  coinsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  coinsInput: { 
    flex: 1, borderWidth: 1, borderColor: COLORS.gray200, 
    borderRadius: 12, padding: 12, fontSize: 16, fontWeight: '600',
    textAlign: 'center',
  },
  maxBtn: { 
    backgroundColor: COLORS.primaryLight, borderRadius: 12, 
    paddingHorizontal: 20, justifyContent: 'center',
  },
  maxBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  coinsValueRow: { 
    backgroundColor: '#FEF3C7', borderRadius: 10, padding: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  coinsValueText: { fontSize: 13, fontWeight: '600', color: '#92400E', flex: 1 },
  coinsNote: { fontSize: 11, color: '#B45309', fontStyle: 'italic' },
  // Address styles
  addressItem: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, borderRadius: 12, borderWidth: 2, borderColor: COLORS.gray200, marginBottom: 8 },
  addressItemActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.gray300, marginRight: 12, marginTop: 2 },
  radioActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  addressLabel: { fontSize: 11, fontWeight: '700', color: COLORS.gray500, marginBottom: 4 },
  addressText: { fontSize: 13, color: COLORS.gray700, lineHeight: 18 },
  // Total card
  totalCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, marginBottom: 12 },
  subtotalAmount: { fontSize: 16, fontWeight: '600', color: COLORS.gray900, marginBottom: 12 },
  discountRow: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6,
  },
  discountLabel: { fontSize: 13, color: COLORS.gray600 },
  discountValue: { fontSize: 14, fontWeight: '600', color: '#059669' },
  totalDivider: { 
    height: 1, backgroundColor: COLORS.gray200, marginVertical: 12,
  },
  finalTotalRow: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  grandTotalLabel: { fontSize: 16, fontWeight: '600', color: COLORS.gray700 },
  grandTotalValue: { fontSize: 24, fontWeight: '800', color: COLORS.gray900 },
  savingsText: { fontSize: 12, color: '#059669', marginTop: 2 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.gray100, padding: 16, paddingBottom: 32 },
  placeOrderBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  placeOrderBtnText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.gray700, marginBottom: 24 },
  shopBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32 },
  shopBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.gray900, marginBottom: 16 },
  labelRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  labelChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.gray200 },
  labelChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  labelChipText: { fontSize: 13, fontWeight: '600', color: COLORS.gray500 },
  labelChipTextActive: { color: COLORS.primary },
  modalInput: { borderWidth: 1, borderColor: COLORS.gray200, borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 12 },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.gray200, alignItems: 'center' },
  modalCancelText: { color: COLORS.gray600, fontWeight: '600' },
  modalSaveBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: 'center' },
  modalSaveText: { color: COLORS.white, fontWeight: '700' },
  // Success modal
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
