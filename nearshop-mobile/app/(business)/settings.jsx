import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Switch, Alert, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import useMyShop from '../../hooks/useMyShop';
import useAuthStore from '../../store/authStore';
import { updateShop } from '../../lib/shops';
import { switchRole as apiSwitchRole } from '../../lib/auth';
import { COLORS, SHADOWS } from '../../constants/theme';

const DELIVERY_OPTIONS = [
  { key: 'pickup', label: 'Pickup', icon: '🏪', desc: 'Customer picks up from your shop' },
  { key: 'delivery', label: 'Delivery', icon: '🚚', desc: 'You deliver to the customer' },
];

const CATEGORIES = [
  'grocery', 'electronics', 'clothing', 'food', 'bakery',
  'pharmacy', 'restaurant', 'furniture', 'jewellery', 'general',
];

export default function SettingsScreen() {
  const { shop, shopId, loading: shopLoading } = useMyShop();
  const { switchRole: storeSwitchRole, logout } = useAuthStore();

  // Shop info
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  // Delivery config
  const [deliveryOptions, setDeliveryOptions] = useState(['pickup']);
  const [deliveryRadius, setDeliveryRadius] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [freeDeliveryAbove, setFreeDeliveryAbove] = useState('');
  const [minOrder, setMinOrder] = useState('');

  const [saving, setSaving] = useState(false);

  // Load shop data into form
  useEffect(() => {
    if (shop) {
      setName(shop.name || '');
      setCategory(shop.category || '');
      setDescription(shop.description || '');
      setAddress(shop.address || '');
      setPhone(shop.phone || '');
      setWhatsapp(shop.whatsapp || '');
      setDeliveryOptions(shop.delivery_options || ['pickup']);
      setDeliveryRadius(shop.delivery_radius ? String(shop.delivery_radius) : '');
      setDeliveryFee(shop.delivery_fee ? String(shop.delivery_fee) : '');
      setFreeDeliveryAbove(shop.free_delivery_above ? String(shop.free_delivery_above) : '');
      setMinOrder(shop.min_order ? String(shop.min_order) : '');
    }
  }, [shop]);

  const toggleDeliveryOption = (key) => {
    setDeliveryOptions((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // must keep at least one
        return prev.filter((o) => o !== key);
      }
      return [...prev, key];
    });
  };

  const hasDelivery = deliveryOptions.includes('delivery');

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Shop name is required');
      return;
    }
    if (!shopId) return;

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        description: description.trim() || undefined,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
        delivery_options: deliveryOptions,
        delivery_radius: deliveryRadius ? Number(deliveryRadius) : undefined,
        delivery_fee: deliveryFee ? Number(deliveryFee) : 0,
        free_delivery_above: freeDeliveryAbove ? Number(freeDeliveryAbove) : undefined,
        min_order: minOrder ? Number(minOrder) : undefined,
      };
      await updateShop(shopId, payload);
      Alert.alert('Saved', 'Shop settings updated successfully!');
    } catch (err) {
      const detail = err.response?.data?.detail;
      Alert.alert('Error', typeof detail === 'string' ? detail : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchToCustomer = async () => {
    try {
      await apiSwitchRole('customer');
      await storeSwitchRole('customer');
      router.replace('/(customer)/home');
    } catch {
      Alert.alert('Error', 'Could not switch to customer mode');
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => { await logout(); router.replace('/(auth)/login'); },
      },
    ]);
  };

  if (shopLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.white} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* Header */}
        <Text style={styles.pageTitle}>Shop Settings</Text>

        {/* ── Shop Info Section ──────────────────────────────────── */}
        <Text style={styles.sectionLabel}>SHOP INFO</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Shop Name *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your shop name" placeholderTextColor={COLORS.gray400} />

          <Text style={styles.fieldLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.chipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput style={[styles.input, styles.inputMulti]} value={description} onChangeText={setDescription} placeholder="Describe your shop..." placeholderTextColor={COLORS.gray400} multiline numberOfLines={3} />

          <Text style={styles.fieldLabel}>Address</Text>
          <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Full shop address" placeholderTextColor={COLORS.gray400} />

          <View style={styles.row}>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="10-digit" placeholderTextColor={COLORS.gray400} keyboardType="phone-pad" />
            </View>
            <View style={styles.halfField}>
              <Text style={styles.fieldLabel}>WhatsApp</Text>
              <TextInput style={styles.input} value={whatsapp} onChangeText={setWhatsapp} placeholder="WhatsApp no." placeholderTextColor={COLORS.gray400} keyboardType="phone-pad" />
            </View>
          </View>
        </View>

        {/* ── Delivery Configuration ──────────────────────────────── */}
        <Text style={styles.sectionLabel}>DELIVERY SETTINGS</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Fulfillment Options</Text>
          <Text style={styles.fieldHint}>Select how customers can receive their orders</Text>
          {DELIVERY_OPTIONS.map(({ key, label, icon, desc }) => {
            const active = deliveryOptions.includes(key);
            return (
              <TouchableOpacity
                key={key}
                style={[styles.deliveryRow, active && styles.deliveryRowActive]}
                onPress={() => toggleDeliveryOption(key)}
                activeOpacity={0.7}
              >
                <Text style={styles.deliveryIcon}>{icon}</Text>
                <View style={styles.deliveryInfo}>
                  <Text style={[styles.deliveryLabel, active && styles.deliveryLabelActive]}>{label}</Text>
                  <Text style={styles.deliveryDesc}>{desc}</Text>
                </View>
                <Switch
                  value={active}
                  onValueChange={() => toggleDeliveryOption(key)}
                  trackColor={{ false: COLORS.gray200, true: COLORS.primaryLight }}
                  thumbColor={active ? COLORS.primary : COLORS.gray400}
                />
              </TouchableOpacity>
            );
          })}

          {/* Delivery-specific fields (shown only when delivery is enabled) */}
          {hasDelivery && (
            <View style={styles.deliveryFields}>
              <View style={styles.deliveryFieldRow}>
                <View style={styles.deliveryFieldItem}>
                  <Text style={styles.fieldLabel}>Delivery Fee (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={deliveryFee}
                    onChangeText={setDeliveryFee}
                    placeholder="e.g. 30"
                    placeholderTextColor={COLORS.gray400}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.deliveryFieldItem}>
                  <Text style={styles.fieldLabel}>Free Delivery Above (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={freeDeliveryAbove}
                    onChangeText={setFreeDeliveryAbove}
                    placeholder="e.g. 500"
                    placeholderTextColor={COLORS.gray400}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.deliveryFieldRow}>
                <View style={styles.deliveryFieldItem}>
                  <Text style={styles.fieldLabel}>Delivery Radius (km)</Text>
                  <TextInput
                    style={styles.input}
                    value={deliveryRadius}
                    onChangeText={setDeliveryRadius}
                    placeholder="e.g. 5"
                    placeholderTextColor={COLORS.gray400}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.deliveryFieldItem}>
                  <Text style={styles.fieldLabel}>Min. Order (₹)</Text>
                  <TextInput
                    style={styles.input}
                    value={minOrder}
                    onChangeText={setMinOrder}
                    placeholder="e.g. 100"
                    placeholderTextColor={COLORS.gray400}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Summary */}
              <View style={styles.summaryBox}>
                <Text style={styles.summaryTitle}>Delivery Summary</Text>
                <Text style={styles.summaryText}>
                  {deliveryFee && Number(deliveryFee) > 0
                    ? `₹${deliveryFee} delivery fee`
                    : 'Free delivery'}
                  {freeDeliveryAbove ? ` · Free above ₹${freeDeliveryAbove}` : ''}
                  {deliveryRadius ? ` · Within ${deliveryRadius}km` : ''}
                  {minOrder ? ` · Min order ₹${minOrder}` : ''}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Save Button ──────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.saveBtnText}>Save Settings</Text>
          )}
        </TouchableOpacity>

        {/* ── Account Section ──────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.menuRow} onPress={handleSwitchToCustomer}>
            <Text style={styles.menuIcon}>👤</Text>
            <Text style={styles.menuLabel}>Switch to Customer</Text>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuRow, styles.menuRowLast]} onPress={handleLogout}>
            <Text style={styles.menuIcon}>🚪</Text>
            <Text style={[styles.menuLabel, { color: COLORS.red }]}>Sign Out</Text>
            <Text style={[styles.menuChevron, { color: COLORS.red }]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingBottom: 40 },
  pageTitle: { fontSize: 24, fontWeight: '800', color: COLORS.gray900, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },

  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.gray400, textTransform: 'uppercase',
    letterSpacing: 0.8, marginTop: 24, marginBottom: 8, marginHorizontal: 16,
  },
  card: {
    backgroundColor: COLORS.white, borderRadius: 16, marginHorizontal: 16, padding: 16,
    ...SHADOWS.card,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.gray600, marginBottom: 6, marginTop: 12 },
  fieldHint: { fontSize: 12, color: COLORS.gray400, marginBottom: 8, marginTop: -4 },
  input: {
    backgroundColor: COLORS.gray50, borderRadius: 10, borderWidth: 1, borderColor: COLORS.gray200,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: COLORS.gray900,
  },
  inputMulti: { minHeight: 70, textAlignVertical: 'top', paddingTop: 11 },

  row: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },

  chipScroll: { flexGrow: 0, marginTop: 2, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.gray100,
    marginRight: 8, borderWidth: 1, borderColor: 'transparent',
  },
  chipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: COLORS.gray600 },
  chipTextActive: { color: COLORS.primaryDark, fontWeight: '700' },

  // Delivery options
  deliveryRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12,
    backgroundColor: COLORS.gray50, marginBottom: 8, gap: 12,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  deliveryRowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight + '40' },
  deliveryIcon: { fontSize: 24 },
  deliveryInfo: { flex: 1 },
  deliveryLabel: { fontSize: 15, fontWeight: '600', color: COLORS.gray700 },
  deliveryLabelActive: { color: COLORS.primaryDark },
  deliveryDesc: { fontSize: 12, color: COLORS.gray400, marginTop: 2 },

  deliveryFields: { marginTop: 8, borderTopWidth: 1, borderTopColor: COLORS.gray100, paddingTop: 8 },
  deliveryFieldRow: { flexDirection: 'row', gap: 12 },
  deliveryFieldItem: { flex: 1 },

  summaryBox: {
    backgroundColor: COLORS.greenLight, borderRadius: 10, padding: 12, marginTop: 16,
  },
  summaryTitle: { fontSize: 13, fontWeight: '700', color: COLORS.green, marginBottom: 4 },
  summaryText: { fontSize: 13, color: COLORS.green, lineHeight: 18 },

  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginHorizontal: 16, marginTop: 24,
  },
  saveBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 16 },

  // Account menu
  menuRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray100, gap: 12,
  },
  menuRowLast: { borderBottomWidth: 0 },
  menuIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: COLORS.gray800 },
  menuChevron: { fontSize: 22, color: COLORS.gray300 },
});
