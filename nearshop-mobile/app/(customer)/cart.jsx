import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  StatusBar, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import useCartStore from '../../store/cartStore';
import { alert } from '../../components/ui/PremiumAlert';
import { COLORS, SHADOWS } from '../../constants/theme';

const formatPrice = (v) => '₹' + Number(v || 0).toLocaleString('en-IN');

function CartItem({ item, onUpdate, onRemove }) {
  return (
    <View style={[styles.itemCard, SHADOWS.card]}>
      <View style={styles.itemImage}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.itemImg} />
        ) : (
          <Text style={styles.itemImgPlaceholder}>📦</Text>
        )}
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
        <View style={styles.qtyRow}>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => onUpdate(item.product_id, item.quantity - 1)}>
            <Text style={styles.qtyBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qtyVal}>{item.quantity}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => onUpdate(item.product_id, item.quantity + 1)}>
            <Text style={styles.qtyBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.lineTotal}>{formatPrice(item.price * item.quantity)}</Text>
        <TouchableOpacity onPress={() => onRemove(item.product_id)} style={styles.removeBtn}>
          <Text style={styles.removeBtnText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const router = useRouter();
  const { items, updateQuantity, removeItem, clearCart, getItemCount, getSubtotal, getShopGroups, initialize } = useCartStore();

  useEffect(() => { initialize(); }, []);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => handler.remove();
  }, []);

  const shopGroups = getShopGroups();
  const itemCount = getItemCount();
  const subtotal = getSubtotal();

  const handleRemove = async (id) => {
    const confirmed = await alert.confirm({
      title: 'Remove Item',
      message: 'Remove this item from your cart?',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (confirmed) {
      removeItem(id);
    }
  };

  const handleClearCart = async () => {
    const confirmed = await alert.confirm({
      title: 'Clear Cart',
      message: 'Remove all items?',
      confirmText: 'Clear',
      cancelText: 'Cancel',
      type: 'danger',
    });
    if (confirmed) {
      clearCart();
    }
  };

  const renderGroup = ({ item: group }) => (
    <View style={styles.groupSection}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupIcon}>🏪</Text>
        <Text style={styles.groupName}>{group.shop_name}</Text>
      </View>
      {group.items.map((item) => (
        <CartItem key={item.product_id} item={item} onUpdate={updateQuantity} onRemove={handleRemove} />
      ))}
      <View style={styles.groupSubtotal}>
        <Text style={styles.groupSubtotalLabel}>Subtotal</Text>
        <Text style={styles.groupSubtotalValue}>{formatPrice(group.subtotal)}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cart ({itemCount})</Text>
        {items.length > 0 && (
          <TouchableOpacity onPress={handleClearCart}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptyMsg}>Browse products and add them to your cart</Text>
          <TouchableOpacity style={styles.shopBtn} onPress={() => router.back()}>
            <Text style={styles.shopBtnText}>Start Shopping</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={shopGroups}
            keyExtractor={(g) => g.shop_id}
            renderItem={renderGroup}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          />
          <View style={[styles.footer, SHADOWS.card]}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total ({itemCount} items)</Text>
              <Text style={styles.totalValue}>{formatPrice(subtotal)}</Text>
            </View>
            <TouchableOpacity style={styles.checkoutBtn} onPress={() => router.push('/(customer)/checkout')}>
              <Text style={styles.checkoutBtnText}>Proceed to Checkout →</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.gray100 },
  backArrow: { fontSize: 32, color: COLORS.gray700, lineHeight: 36 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.gray900 },
  clearText: { fontSize: 14, fontWeight: '600', color: COLORS.red || '#EF4444' },
  list: { padding: 16, paddingBottom: 140 },
  groupSection: { marginBottom: 20 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  groupIcon: { fontSize: 18 },
  groupName: { fontSize: 15, fontWeight: '700', color: COLORS.gray900 },
  itemCard: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 12, padding: 12, marginBottom: 8 },
  itemImage: { width: 60, height: 60, borderRadius: 8, backgroundColor: COLORS.gray100, overflow: 'hidden', marginRight: 10 },
  itemImg: { width: '100%', height: '100%' },
  itemImgPlaceholder: { fontSize: 24, textAlign: 'center', lineHeight: 60 },
  itemInfo: { flex: 1, marginRight: 8 },
  itemName: { fontSize: 13, fontWeight: '600', color: COLORS.gray900, marginBottom: 2 },
  itemPrice: { fontSize: 14, fontWeight: '700', color: COLORS.gray900, marginBottom: 6 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, borderColor: COLORS.gray200 || '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  qtyBtnText: { fontSize: 16, fontWeight: '600', color: COLORS.gray700 },
  qtyVal: { fontSize: 14, fontWeight: '700', color: COLORS.gray900, minWidth: 20, textAlign: 'center' },
  itemRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
  lineTotal: { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
  removeBtn: { padding: 4 },
  removeBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.red || '#EF4444' },
  groupSubtotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.gray100 },
  groupSubtotalLabel: { fontSize: 13, color: COLORS.gray500 },
  groupSubtotalValue: { fontSize: 14, fontWeight: '700', color: COLORS.gray900 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.gray100, padding: 16, paddingBottom: 32 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalLabel: { fontSize: 14, color: COLORS.gray600 },
  totalValue: { fontSize: 20, fontWeight: '800', color: COLORS.gray900 },
  checkoutBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  checkoutBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.gray700, marginBottom: 6 },
  emptyMsg: { fontSize: 14, color: COLORS.gray500, textAlign: 'center', marginBottom: 24 },
  shopBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 32 },
  shopBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
});
