import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Switch, ActivityIndicator, StatusBar, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import useMyShop from '../../hooks/useMyShop';
import useAuthStore from '../../store/authStore';
import { updateShop, requestVerification, getVerificationStatus } from '../../lib/shops';
import { switchRole as apiSwitchRole } from '../../lib/auth';
import { COLORS, SHADOWS } from '../../constants/theme';
import { toast } from '../../components/ui/Toast/toastRef';
import { alert } from '../../components/ui/PremiumAlert';
import DeliveryTimeSlotsModal from '../../components/DeliveryTimeSlotsModal';

const DELIVERY_OPTIONS = [
  { key: 'pickup', label: 'Pickup', icon: '🏪', desc: 'Customer picks up from your shop' },
  { key: 'delivery', label: 'Delivery', icon: '🚚', desc: 'You deliver to the customer' },
];

const CATEGORIES = [
  'grocery', 'electronics', 'clothing', 'food', 'bakery',
  'pharmacy', 'restaurant', 'furniture', 'jewellery', 'general',
];

const DOCUMENT_TYPES = [
  { key: 'gst', label: 'GST Certificate', icon: '📋', required: false },
  { key: 'pan', label: 'PAN Card', icon: '🪪', required: true },
  { key: 'aadhaar', label: 'Aadhaar Card', icon: '🆔', required: true },
  { key: 'fssai', label: 'FSSAI License', icon: '🍽️', required: false },
  { key: 'trade', label: 'Trade License', icon: '📄', required: false },
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

  // Delivery hours state
  const [deliveryAvailability, setDeliveryAvailability] = useState('all_day');
  const [deliveryHours, setDeliveryHours] = useState([]);
  const [showDeliveryHoursModal, setShowDeliveryHoursModal] = useState(false);

  const [saving, setSaving] = useState(false);
  
  // Verification state
  const [verificationStatus, setVerificationStatus] = useState('none');
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [showVerificationForm, setShowVerificationForm] = useState(false);

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
      setDeliveryAvailability(shop.delivery_available || 'all_day');
      setDeliveryHours(shop.delivery_hours || []);
    }
  }, [shop]);

  // Load verification status
  useEffect(() => {
    if (shopId) {
      getVerificationStatus(shopId)
        .then((res) => {
          const data = res?.data;
          setVerificationStatus(data?.status || 'none');
        })
        .catch(() => setVerificationStatus('none'));
    }
  }, [shopId]);

  const toggleDeliveryOption = (key) => {
    setDeliveryOptions((prev) => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // must keep at least one
        return prev.filter((o) => o !== key);
      }
      return [...prev, key];
    });
  };
  
  const toggleDocumentSelection = (key) => {
    setSelectedDocs((prev) => {
      if (prev.includes(key)) {
        return prev.filter((d) => d !== key);
      }
      return [...prev, key];
    });
  };

  const handleSubmitVerification = async () => {
    if (selectedDocs.length === 0) {
      alert.warning({ title: 'Required', message: 'Please select at least one document type' });
      return;
    }
    
    const requiredDocs = DOCUMENT_TYPES.filter(d => d.required).map(d => d.key);
    const missingRequired = requiredDocs.filter(d => !selectedDocs.includes(d));
    
    if (missingRequired.length > 0) {
      const missing = DOCUMENT_TYPES.filter(d => missingRequired.includes(d.key)).map(d => d.label);
      alert.warning({ title: 'Required Documents', message: `Please select: ${missing.join(', ')}` });
      return;
    }
    
    setSubmittingVerification(true);
    try {
      await requestVerification(shopId, selectedDocs);
      setVerificationStatus('pending');
      setShowVerificationForm(false);
      alert.success({ title: 'Success', message: 'Verification request submitted! We\'ll review your documents within 2-3 business days.' });
    } catch (err) {
      const detail = err.response?.data?.detail;
      alert.error({ title: 'Error', message: typeof detail === 'string' ? detail : 'Failed to submit verification' });
    } finally {
      setSubmittingVerification(false);
    }
  };

  const handleDeliveryHoursSave = (availability, slots) => {
    setDeliveryAvailability(availability);
    setDeliveryHours(slots);
  };

  const formatDeliveryHoursDisplay = () => {
    if (deliveryAvailability === 'all_day') return 'All Day';
    if (deliveryAvailability === 'peak') return 'Peak Hours Only';
    if (deliveryHours.length === 0) return 'Not Set';
    
    const formatTime = (time24) => {
      if (!time24) return '';
      const [hours, minutes] = time24.split(':');
      const h = parseInt(hours, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12}:${minutes} ${ampm}`;
    };
    
    return deliveryHours.map(s => `${formatTime(s.from)} - ${formatTime(s.to)}`).join(', ');
  };

  const hasDelivery = deliveryOptions.includes('delivery');

  const handleSave = async () => {
    if (!name.trim()) {
      alert.warning({ title: 'Validation', message: 'Shop name is required' });
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
        delivery_available: deliveryAvailability,
        delivery_hours: deliveryHours,
      };
      await updateShop(shopId, payload);
      alert.success({ title: 'Saved', message: 'Shop settings updated successfully!' });
    } catch (err) {
      const detail = err.response?.data?.detail;
      alert.error({ title: 'Error', message: typeof detail === 'string' ? detail : 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchToCustomer = async () => {
    try {
      const response = await apiSwitchRole('customer');
      // Tokens are automatically saved by auth.js switchRole function
      if (response?.data?.user) {
        await useAuthStore.getState().updateUser(response.data.user);
      } else {
        await storeSwitchRole('customer');
      }
      router.replace('/(customer)/home');
    } catch (err) {
      alert.error({ title: 'Error', message: err?.response?.data?.detail || 'Could not switch to customer mode' });
    }
  };

  const handleLogout = async () => {
    const confirmed = await alert.confirm({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      confirmText: 'Sign Out',
      cancelText: 'Cancel',
      variant: 'danger',
    });
    
    if (confirmed) {
      await logout();
      router.replace('/(auth)/login');
    }
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

              {/* Delivery Hours Button */}
              <TouchableOpacity
                style={styles.deliveryHoursBtn}
                onPress={() => setShowDeliveryHoursModal(true)}
              >
                <View style={styles.deliveryHoursBtnIcon}>
                  <Ionicons name="time-outline" size={20} color={COLORS.primary} />
                </View>
                <View style={styles.deliveryHoursBtnContent}>
                  <Text style={styles.deliveryHoursBtnTitle}>Delivery Hours</Text>
                  <Text style={styles.deliveryHoursBtnValue}>
                    {formatDeliveryHoursDisplay()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.gray400} />
              </TouchableOpacity>

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

        {/* Delivery Hours Modal */}
        <DeliveryTimeSlotsModal
          visible={showDeliveryHoursModal}
          onClose={() => setShowDeliveryHoursModal(false)}
          initialAvailability={deliveryAvailability}
          initialSlots={deliveryHours}
          onSave={handleDeliveryHoursSave}
        />

        {/* ── Shop Branding Section ──────────────────────────────── */}
        <Text style={styles.sectionLabel}>SHOP BRANDING</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.brandingCTA}
            onPress={() => router.push('/(business)/branding')}
          >
            <View style={styles.brandingCTAIcon}>
              <Text style={{ fontSize: 24 }}>🎨</Text>
            </View>
            <View style={styles.brandingCTAContent}>
              <Text style={styles.brandingCTATitle}>Logo & Images</Text>
              <Text style={styles.brandingCTADesc}>
                {shop?.logo_url ? 'Customize your shop appearance' : 'Add logo, banner & gallery images'}
              </Text>
            </View>
            <Text style={styles.menuChevron}>›</Text>
          </TouchableOpacity>
          
          {/* Quick preview */}
          {(shop?.logo_url || shop?.cover_image) && (
            <View style={styles.brandingPreview}>
              {shop?.cover_image && (
                <View style={styles.brandingPreviewBanner}>
                  <Image source={{ uri: shop.cover_image }} style={styles.brandingPreviewBannerImg} />
                </View>
              )}
              {shop?.logo_url && (
                <View style={styles.brandingPreviewLogo}>
                  <Image source={{ uri: shop.logo_url }} style={styles.brandingPreviewLogoImg} />
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Shop Verification Section ──────────────────────────────── */}
        <Text style={styles.sectionLabel}>SHOP VERIFICATION</Text>
        <View style={styles.card}>
          {/* Status Banner */}
          {verificationStatus === 'approved' && (
            <View style={styles.verificationBanner}>
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedIcon}>✓</Text>
              </View>
              <View style={styles.verificationBannerText}>
                <Text style={styles.verifiedTitle}>Verified Shop</Text>
                <Text style={styles.verifiedSubtitle}>Your shop is verified and trusted</Text>
              </View>
            </View>
          )}
          
          {verificationStatus === 'pending' && (
            <View style={[styles.verificationBanner, styles.pendingBanner]}>
              <Text style={styles.pendingIcon}>⏳</Text>
              <View style={styles.verificationBannerText}>
                <Text style={styles.pendingTitle}>Verification Pending</Text>
                <Text style={styles.pendingSubtitle}>We're reviewing your documents (2-3 business days)</Text>
              </View>
            </View>
          )}
          
          {verificationStatus === 'rejected' && (
            <View style={[styles.verificationBanner, styles.rejectedBanner]}>
              <Text style={styles.rejectedIcon}>✗</Text>
              <View style={styles.verificationBannerText}>
                <Text style={styles.rejectedTitle}>Verification Rejected</Text>
                <Text style={styles.rejectedSubtitle}>Please resubmit with correct documents</Text>
              </View>
            </View>
          )}
          
          {/* Apply for Verification or Reapply */}
          {(verificationStatus === 'none' || verificationStatus === 'rejected') && (
            <>
              {!showVerificationForm ? (
                <TouchableOpacity
                  style={styles.verificationCTA}
                  onPress={() => setShowVerificationForm(true)}
                >
                  <View style={styles.verificationCTAIcon}>
                    <Text style={{ fontSize: 24 }}>🛡️</Text>
                  </View>
                  <View style={styles.verificationCTAContent}>
                    <Text style={styles.verificationCTATitle}>
                      {verificationStatus === 'rejected' ? 'Reapply for Verification' : 'Get Your Shop Verified'}
                    </Text>
                    <Text style={styles.verificationCTADesc}>
                      Build trust with customers by verifying your business
                    </Text>
                  </View>
                  <Text style={styles.menuChevron}>›</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.verificationForm}>
                  <Text style={styles.verificationFormTitle}>Select Documents to Submit</Text>
                  <Text style={styles.verificationFormDesc}>
                    Please have these documents ready for verification
                  </Text>
                  
                  {DOCUMENT_TYPES.map(({ key, label, icon, required }) => {
                    const isSelected = selectedDocs.includes(key);
                    return (
                      <TouchableOpacity
                        key={key}
                        style={[styles.docOption, isSelected && styles.docOptionActive]}
                        onPress={() => toggleDocumentSelection(key)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.docIcon}>{icon}</Text>
                        <View style={styles.docInfo}>
                          <Text style={[styles.docLabel, isSelected && styles.docLabelActive]}>
                            {label}
                          </Text>
                          {required && <Text style={styles.docRequired}>Required</Text>}
                        </View>
                        <View style={[styles.docCheckbox, isSelected && styles.docCheckboxActive]}>
                          {isSelected && <Text style={styles.docCheckmark}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                  
                  <View style={styles.verificationActions}>
                    <TouchableOpacity
                      style={styles.cancelVerificationBtn}
                      onPress={() => {
                        setShowVerificationForm(false);
                        setSelectedDocs([]);
                      }}
                    >
                      <Text style={styles.cancelVerificationText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.submitVerificationBtn, submittingVerification && { opacity: 0.7 }]}
                      onPress={handleSubmitVerification}
                      disabled={submittingVerification}
                    >
                      {submittingVerification ? (
                        <ActivityIndicator color={COLORS.white} size="small" />
                      ) : (
                        <Text style={styles.submitVerificationText}>Submit Request</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}
          
          {verificationStatus === 'approved' && (
            <View style={styles.verificationBenefits}>
              <Text style={styles.benefitsTitle}>Verified Shop Benefits</Text>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>✓</Text>
                <Text style={styles.benefitText}>Verified badge on your shop</Text>
              </View>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>✓</Text>
                <Text style={styles.benefitText}>Higher visibility in search</Text>
              </View>
              <View style={styles.benefitRow}>
                <Text style={styles.benefitIcon}>✓</Text>
                <Text style={styles.benefitText}>Increased customer trust</Text>
              </View>
            </View>
          )}
        </View>

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

  // Delivery Hours Button
  deliveryHoursBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primaryLight + '30',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.primary + '40',
    gap: 12,
  },
  deliveryHoursBtnIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deliveryHoursBtnContent: {
    flex: 1,
  },
  deliveryHoursBtnTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray800,
  },
  deliveryHoursBtnValue: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '500',
    marginTop: 2,
  },

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

  // Branding Section
  brandingCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 2,
    gap: 12,
  },
  brandingCTAIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandingCTAContent: {
    flex: 1,
  },
  brandingCTATitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.gray800,
  },
  brandingCTADesc: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 2,
  },
  brandingPreview: {
    marginTop: 14,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.gray100,
    height: 80,
  },
  brandingPreviewBanner: {
    width: '100%',
    height: '100%',
  },
  brandingPreviewBannerImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  brandingPreviewLogo: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.white,
    backgroundColor: COLORS.white,
  },
  brandingPreviewLogoImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  // Verification Section
  verificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 12,
  },
  pendingBanner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  rejectedBanner: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  verificationBannerText: {
    flex: 1,
  },
  verifiedBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedIcon: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  verifiedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
  },
  verifiedSubtitle: {
    fontSize: 12,
    color: '#22C55E',
    marginTop: 2,
  },
  pendingIcon: {
    fontSize: 28,
  },
  pendingTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  pendingSubtitle: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  rejectedIcon: {
    fontSize: 28,
    color: '#DC2626',
  },
  rejectedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991B1B',
  },
  rejectedSubtitle: {
    fontSize: 12,
    color: '#DC2626',
    marginTop: 2,
  },
  verificationCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: COLORS.primaryLight + '30',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary + '50',
    gap: 12,
  },
  verificationCTAIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verificationCTAContent: {
    flex: 1,
  },
  verificationCTATitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },
  verificationCTADesc: {
    fontSize: 12,
    color: COLORS.gray500,
    marginTop: 2,
  },
  verificationForm: {
    marginTop: 4,
  },
  verificationFormTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.gray900,
    marginBottom: 4,
  },
  verificationFormDesc: {
    fontSize: 13,
    color: COLORS.gray500,
    marginBottom: 16,
  },
  docOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: COLORS.gray50,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 12,
  },
  docOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight + '40',
  },
  docIcon: {
    fontSize: 22,
  },
  docInfo: {
    flex: 1,
  },
  docLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray700,
  },
  docLabelActive: {
    color: COLORS.primaryDark,
  },
  docRequired: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  docCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.gray300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docCheckboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  docCheckmark: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  verificationActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelVerificationBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.gray300,
    alignItems: 'center',
  },
  cancelVerificationText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray600,
  },
  submitVerificationBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  submitVerificationText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  verificationBenefits: {
    marginTop: 4,
  },
  benefitsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray700,
    marginBottom: 10,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  benefitIcon: {
    color: '#22C55E',
    fontSize: 16,
    fontWeight: '700',
  },
  benefitText: {
    fontSize: 13,
    color: COLORS.gray600,
  },
});
