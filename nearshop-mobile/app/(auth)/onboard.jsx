import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Image, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { toast } from '../../components/ui/Toast';
import { alert } from '../../components/ui/PremiumAlert';
import { completeProfile, uploadFile } from '../../lib/auth';
import { createShop } from '../../lib/shops';
import client from '../../lib/api';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { COLORS, SHADOWS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

const INTERESTS = [
  'Clothing & Fashion', 'Electronics', 'Grocery & Daily Needs',
  'Food & Bakery', 'Home & Kitchen', 'Beauty & Personal Care',
  'Books & Stationery', 'Sports & Fitness', 'Jewelry & Accessories', 'Toys & Games',
];

const SHOP_CATEGORIES = [
  'Electronics', 'Clothing', 'Grocery', 'Food', 'Home', 'Beauty', 'Other',
];

const DELIVERY_OPTIONS = [
  { label: 'Pickup', value: 'pickup' },
  { label: 'Home Delivery', value: 'delivery' },
  { label: 'Both', value: 'both' },
];

export default function OnboardScreen() {
  const { role } = useLocalSearchParams();
  const router = useRouter();
  const { updateUser } = useAuthStore();
  const { lat, lng, address: locationAddress } = useLocationStore();

  // Customer fields
  const [name, setName] = useState('');
  const [interests, setInterests] = useState([]);

  // Business fields
  const [ownerName, setOwnerName] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopCat, setShopCat] = useState([]);
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(false);
  const [shopAddress, setShopAddress] = useState('');
  const [logoUri, setLogoUri] = useState(null);
  const [deliveryOption, setDeliveryOption] = useState('pickup');
  const [deliveryFree, setDeliveryFree] = useState(true);
  const [deliveryRadius, setDeliveryRadius] = useState('5');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [deliveryAvailable, setDeliveryAvailable] = useState('all_day');
  const [specificHours, setSpecificHours] = useState([{ from: '09:00', to: '18:00' }]);
  const [showHoursModal, setShowHoursModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [step, setStep] = useState(1); // Business: 3 steps now

  // Initialize shop address from location
  useEffect(() => {
    if (role === 'business' && locationAddress && !shopAddress) {
      setShopAddress(locationAddress);
    }
  }, [locationAddress, role, shopAddress]);

  const toggleInterest = (item) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const pickLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert.warning({ title: 'Permission needed', message: 'Please allow photo access to upload a shop logo.' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      setLogoUri(result.assets[0].uri);
    }
  };

  const handleGenerateDescription = async () => {
    if (!shopName.trim()) {
      toast.show({ type: 'info', text1: 'Enter shop name first' });
      return;
    }
    setAiLoading(true);
    try {
      // Use authPost to include authentication token
      const { authPost } = await import('../../lib/api');
      const { data } = await authPost('/ai/generate-description', {
        shop_name: shopName.trim(),
        category: shopCat.length > 0 ? shopCat[0] : 'General',
        keywords: description.trim() || shopName.trim(),
      });
      if (data?.description) {
        setDescription(data.description);
        toast.show({
          type: data?.fallback ? 'info' : 'success',
          text1: data?.fallback ? 'Used smart fallback text' : 'AI description generated!',
          text2: data?.fallback ? (data?.detail || 'You can edit it if needed') : 'You can edit it if needed',
        });
      } else {
        toast.show({ type: 'info', text1: 'AI service unavailable', text2: 'Please type your description manually' });
      }
    } catch (err) {
      console.error('AI description error:', err);
      const errorMsg = err?.response?.data?.detail || err?.response?.data?.message || 'AI service temporarily unavailable';
      toast.show({ type: 'info', text1: 'Type manually', text2: String(errorMsg).substring(0, 80) });
    } finally {
      setAiLoading(false);
    }
  };

  const handleComplete = async () => {
    if (role === 'customer' && (!name.trim() || interests.length < 3)) {
      toast.show({ type: 'error', text1: 'Add your name and pick at least 3 interests' });
      return;
    }
    if (role === 'business') {
      if (!ownerName.trim() || !shopName.trim() || shopCat.length === 0) {
        toast.show({ type: 'error', text1: 'Please fill all required fields' });
        return;
      }
      if (!phone.trim()) {
        toast.show({ type: 'error', text1: 'Phone number is required for business' });
        return;
      }
    }

    setLoading(true);
    try {
      const profileName = role === 'customer' ? name.trim() : ownerName.trim();
      const { data } = await completeProfile({
        name: profileName,
        role,
        interests: role === 'customer' ? interests : [],
      });

      // Handle multiple response formats from backend
      const user = data?.user || data?.data?.user || data;

      // Only update if user object exists and is valid
      if (user && typeof user === 'object' && Object.keys(user).length > 0) {
        await updateUser(user);
      }

      if (role === 'business') {
        // Upload logo if picked
        let logoUrl = null;
        if (logoUri) {
          try {
            const uploadRes = await uploadFile(logoUri, {
              folder: 'shops',
              entityType: 'shop',
              purpose: 'logo',
            });
            logoUrl = uploadRes?.data?.url || uploadRes?.data?.file_url || null;
          } catch {
            // Logo upload failed — continue without it
            console.warn('Logo upload failed, continuing without it');
          }
        }

        const deliveryOpts =
          deliveryOption === 'both' ? ['pickup', 'delivery'] : [deliveryOption];

        await createShop({
          name: shopName.trim(),
          category: shopCat[0],
          categories: shopCat,
          description: description.trim() || undefined,
          phone: phone.trim(),
          whatsapp: whatsapp.trim() || undefined,
          address: shopAddress.trim() || undefined,
          logo_url: logoUrl || undefined,
          delivery_options: deliveryOpts,
          latitude: lat ?? 12.9352,
          longitude: lng ?? 77.6245,
        });
      }

      toast.show({
        type: 'success',
        text1: role === 'customer' ? 'Welcome to NearShop!' : 'Shop created successfully!',
      });
      router.replace(role === 'business' ? '/(business)/dashboard' : '/(customer)/home');
    } catch (err) {
      console.error('Profile completion error:', err);
      // Better error message extraction
      const errorMsg = err.response?.data?.detail || err.response?.data?.message || err.response?.data?.error || err.message || 'Unknown error';
      toast.show({
        type: 'error',
        text1: 'Setup failed',
        text2: String(errorMsg).substring(0, 100),
      });
    } finally {
      setLoading(false);
    }
  };

  const Chip = ({ label, selected, onPress }) => (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  const addTimeSlot = () => {
    setSpecificHours([...specificHours, { from: '09:00', to: '18:00' }]);
  };

  const removeTimeSlot = (index) => {
    if (specificHours.length > 1) {
      setSpecificHours(specificHours.filter((_, i) => i !== index));
    }
  };

  const updateTimeSlot = (index, field, value) => {
    const updated = [...specificHours];
    updated[index][field] = value;
    setSpecificHours(updated);
  };

  const DeliveryHoursModal = () => (
    <Modal
      visible={showHoursModal}
      animationType="slide"
      transparent
      onRequestClose={() => setShowHoursModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Set Delivery Hours</Text>
            <TouchableOpacity onPress={() => setShowHoursModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.gray600} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {specificHours.map((slot, index) => (
              <View key={index} style={styles.timeSlot}>
                <View style={styles.timeSlotHeader}>
                  <Text style={styles.timeSlotLabel}>Time Slot {index + 1}</Text>
                  {specificHours.length > 1 && (
                    <TouchableOpacity onPress={() => removeTimeSlot(index)}>
                      <Ionicons name="trash-outline" size={20} color={COLORS.red} />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.timeInputs}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.timeLabel}>From</Text>
                    <TextInput
                      style={styles.timeInput}
                      value={slot.from}
                      onChangeText={(val) => updateTimeSlot(index, 'from', val)}
                      placeholder="09:00"
                      placeholderTextColor={COLORS.gray400}
                    />
                  </View>

                  <Text style={styles.timeSeparator}>to</Text>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.timeLabel}>To</Text>
                    <TextInput
                      style={styles.timeInput}
                      value={slot.to}
                      onChangeText={(val) => updateTimeSlot(index, 'to', val)}
                      placeholder="18:00"
                      placeholderTextColor={COLORS.gray400}
                    />
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.addSlotBtn} onPress={addTimeSlot}>
              <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.addSlotText}>Add Another Time Slot</Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            style={styles.modalSaveBtn}
            onPress={() => setShowHoursModal(false)}
          >
            <Text style={styles.modalSaveBtnText}>Save Hours</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Customer mode
  if (role === 'customer') {
    const canSubmit = name.trim().length > 0 && interests.length >= 3;
    return (
      <>
        <DeliveryHoursModal />
        <SafeAreaView style={styles.container}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Tell us about yourself</Text>
            <Text style={styles.subtitle}>Personalize your experience by sharing your interests</Text>

            <Text style={styles.label}>Your name <Text style={{ color: COLORS.red }}>*</Text></Text>
            <TextInput value={name} onChangeText={setName} placeholder="e.g. Priya Sharma" placeholderTextColor={COLORS.gray400} style={styles.input} autoCapitalize="words" />

            <Text style={styles.label}>What do you love? <Text style={styles.hint}>(pick 3+)</Text></Text>
            <View style={styles.chips}>
              {INTERESTS.map((item) => (
                <Chip key={item} label={item} selected={interests.includes(item)} onPress={() => toggleInterest(item)} />
              ))}
            </View>

            <TouchableOpacity onPress={handleComplete} disabled={loading || !canSubmit} activeOpacity={0.85}
              style={[styles.btn, { backgroundColor: canSubmit ? COLORS.primary : COLORS.gray200 }]}>
              <Text style={[styles.btnText, { color: canSubmit ? COLORS.white : COLORS.gray400 }]}>
                {loading ? 'Setting up…' : 'Start Exploring'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </>
    );
  }

  // Business mode — Step 1: Basic Info
  if (step === 1) {
    const canNext = ownerName.trim().length > 0 && shopName.trim().length > 0 && shopCat.length >= 1 && phone.trim().length >= 10;
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Set up your shop</Text>
          <Text style={styles.subtitle}>Get online in under 2 minutes</Text>

          <Text style={styles.label}>Your name *</Text>
          <TextInput value={ownerName} onChangeText={setOwnerName} placeholder="e.g. Ramesh Kumar" placeholderTextColor={COLORS.gray400} style={styles.input} autoCapitalize="words" />

          <Text style={styles.label}>Shop name *</Text>
          <TextInput value={shopName} onChangeText={setShopName} placeholder="e.g. Ramesh Electronics" placeholderTextColor={COLORS.gray400} style={styles.input} autoCapitalize="words" />

          <Text style={styles.label}>Category * <Text style={styles.hint}>(select 1 or more)</Text></Text>
          <View style={styles.chips}>
            {SHOP_CATEGORIES.map((cat) => (
              <Chip key={cat} label={cat} selected={shopCat.includes(cat)} onPress={() => setShopCat(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])} />
            ))}
          </View>

          <Text style={styles.label}>Phone number *</Text>
          <TextInput value={phone} onChangeText={(val) => { setPhone(val); if (whatsappSameAsPhone) setWhatsapp(val); }} placeholder="e.g. 9876543210" placeholderTextColor={COLORS.gray400} style={styles.input} keyboardType="phone-pad" maxLength={15} />

          <Text style={styles.label}>WhatsApp number <Text style={styles.hint}>(optional)</Text></Text>
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => {
              const newVal = !whatsappSameAsPhone;
              setWhatsappSameAsPhone(newVal);
              if (newVal) setWhatsapp(phone);
              else setWhatsapp('');
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, whatsappSameAsPhone && styles.checkboxChecked]}>
              {whatsappSameAsPhone && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>Same as phone number</Text>
          </TouchableOpacity>
          {!whatsappSameAsPhone && (
            <TextInput value={whatsapp} onChangeText={setWhatsapp} placeholder="Enter WhatsApp number" placeholderTextColor={COLORS.gray400} style={styles.input} keyboardType="phone-pad" maxLength={15} />
          )}

          <TouchableOpacity onPress={() => setStep(2)} disabled={!canNext} activeOpacity={0.85}
            style={[styles.btn, { backgroundColor: canNext ? COLORS.primary : COLORS.gray200 }]}>
            <Text style={[styles.btnText, { color: canNext ? COLORS.white : COLORS.gray400 }]}>
              Next: Shop Details →
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Business mode — Step 2: Additional Details & Delivery
  const canSubmit = ownerName.trim().length > 0 && shopName.trim().length > 0 && shopCat.length >= 1 && phone.trim().length >= 10;
  const showDeliveryOptions = deliveryOption === 'delivery' || deliveryOption === 'both';
  return (
    <>
      <DeliveryHoursModal />
      <SafeAreaView style={styles.container}>
        <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Almost done!</Text>
          <Text style={styles.subtitle}>Add more details to help customers find you</Text>

          {/* Logo upload */}
          <Text style={styles.label}>Shop logo <Text style={styles.hint}>(optional)</Text></Text>
          <TouchableOpacity style={styles.logoUpload} onPress={pickLogo} activeOpacity={0.8}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoImage} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoPlaceholderIcon}>📷</Text>
                <Text style={styles.logoPlaceholderText}>Tap to upload</Text>
              </View>
            )}
          </TouchableOpacity>

        <Text style={styles.label}>Shop description <Text style={styles.hint}>(optional)</Text></Text>
        <View style={styles.descriptionWrap}>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What does your shop sell? Tell customers about your speciality..."
            placeholderTextColor={COLORS.gray400}
            style={[styles.input, styles.textarea, { marginBottom: 0 }]}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={styles.aiBtn}
            onPress={handleGenerateDescription}
            disabled={aiLoading || !shopName.trim()}
          >
            <Text style={styles.aiBtnText}>{aiLoading ? '...' : '\u2728 AI'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Shop address <Text style={styles.hint}>(optional)</Text></Text>
        <TextInput value={shopAddress} onChangeText={setShopAddress} placeholder="e.g. 42, MG Road, Bangalore" placeholderTextColor={COLORS.gray400} style={styles.input} />

        <Text style={styles.label}>Delivery options</Text>
        <View style={styles.chips}>
          {DELIVERY_OPTIONS.map((opt) => (
            <Chip key={opt.value} label={opt.label} selected={deliveryOption === opt.value} onPress={() => setDeliveryOption(opt.value)} />
          ))}
        </View>

        {/* Delivery Configuration */}
        {showDeliveryOptions && (
          <View style={styles.deliveryCard}>
            <Text style={styles.deliveryTitle}>💬 Delivery Details</Text>

            <Text style={styles.label}>Is delivery free?</Text>
            <View style={styles.chips}>
              {[true, false].map((isFree) => (
                <Chip
                  key={String(isFree)}
                  label={isFree ? 'Free Delivery' : 'Paid Delivery'}
                  selected={deliveryFree === isFree}
                  onPress={() => { setDeliveryFree(isFree); if (isFree) setDeliveryFee(''); }}
                />
              ))}
            </View>

            {!deliveryFree && (
              <>
                <Text style={styles.label}>Delivery fee (₹)</Text>
                <TextInput
                  value={deliveryFee}
                  onChangeText={setDeliveryFee}
                  placeholder="e.g. 40"
                  placeholderTextColor={COLORS.gray400}
                  style={styles.input}
                  keyboardType="numeric"
                />
              </>
            )}

            <Text style={styles.label}>Coverage radius (km)</Text>
            <View style={styles.radiusContainer}>
              <TextInput
                value={deliveryRadius}
                onChangeText={setDeliveryRadius}
                placeholder="e.g. 5"
                placeholderTextColor={COLORS.gray400}
                style={[styles.input, styles.radiusInput]}
                keyboardType="numeric"
              />
              <Text style={styles.radiusLabel}>km from your shop</Text>
            </View>

            <Text style={styles.label}>Delivery available</Text>
            <View style={styles.chips}>
              <Chip
                key="all_day"
                label="All day"
                selected={deliveryAvailable === 'all_day'}
                onPress={() => setDeliveryAvailable('all_day')}
              />
              <Chip
                key="peak"
                label="Peak hours only"
                selected={deliveryAvailable === 'peak'}
                onPress={() => {
                  setDeliveryAvailable('peak');
                  alert.info({
                    title: 'Peak Hours',
                    message: 'Typical peak hours are:\n• Morning: 8 AM - 11 AM\n• Evening: 5 PM - 9 PM\n\nYou can customize these timings later in settings.',
                  });
                }}
              />
              <Chip
                key="specific"
                label="Specific hours"
                selected={deliveryAvailable === 'specific'}
                onPress={() => {
                  setDeliveryAvailable('specific');
                  setShowHoursModal(true);
                }}
              />
            </View>
          </View>
        )}

        <TouchableOpacity onPress={handleComplete} disabled={loading || !canSubmit} activeOpacity={0.85}
          style={[styles.btn, { backgroundColor: canSubmit ? COLORS.primary : COLORS.gray200 }]}>
          <Text style={[styles.btnText, { color: canSubmit ? COLORS.white : COLORS.gray400 }]}>
            {loading ? 'Creating…' : 'Create My Shop'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
    </>
  );

  // Business mode — Step 3: Bulk Product Upload (currently unused — kept for future)
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => setStep(2)} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Add your products</Text>
        <Text style={styles.subtitle}>You can add items individually or upload in bulk</Text>

        {/* Bulk Upload Card */}
        <View style={styles.bulkCard}>
          <Text style={styles.bulkIcon}>📊</Text>
          <Text style={styles.bulkTitle}>Bulk Upload</Text>
          <Text style={styles.bulkDesc}>Import CSV file with multiple products</Text>
          <TouchableOpacity style={styles.uploadBtn} activeOpacity={0.8}>
            <Text style={styles.uploadBtnText}>📤 Choose CSV File</Text>
          </TouchableOpacity>
          <Text style={styles.csvHint}>Format: Product Name, Description, Price, Stock</Text>
        </View>

        {/* Quick Add */}
        <View style={styles.divider} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.divider} />

        <View style={styles.quickAddCard}>
          <Text style={styles.quickAddTitle}>Add First Product</Text>
          <TextInput placeholder="Product name" placeholderTextColor={COLORS.gray400} style={styles.input} />
          <TextInput placeholder="Price (₹)" placeholderTextColor={COLORS.gray400} style={styles.input} keyboardType="numeric" />
          <TextInput placeholder="Stock quantity" placeholderTextColor={COLORS.gray400} style={styles.input} keyboardType="numeric" />
          <TouchableOpacity style={[styles.btn, { backgroundColor: COLORS.gray200 }]}>
            <Text style={[styles.btnText, { color: COLORS.gray600 }]}>+ Add Product</Text>
          </TouchableOpacity>
        </View>

        {/* Submit Buttons */}
        <TouchableOpacity onPress={handleComplete} disabled={loading} activeOpacity={0.85}
          style={[styles.btn, { backgroundColor: COLORS.primary, marginTop: 24 }]}>
          <Text style={[styles.btnText, { color: COLORS.white }]}>
            {loading ? 'Creating…' : 'Create My Shop 🏪'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleComplete} disabled={loading} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip & create shop now</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  backBtn: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 4 },
  backText: { fontSize: 16, fontWeight: '600', color: COLORS.primary },
  scroll: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: '700', color: COLORS.gray900, marginBottom: 8, lineHeight: 34 },
  subtitle: { fontSize: 14, color: COLORS.gray500, lineHeight: 20, marginBottom: 28 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.gray700, marginBottom: 10 },
  hint: { color: COLORS.gray400, fontWeight: '400' },
  input: {
    height: 52, paddingHorizontal: 16, fontSize: 16, color: COLORS.gray900,
    backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.gray200, marginBottom: 20,
  },
  textarea: { height: 100, paddingTop: 14, textAlignVertical: 'top' },
  descriptionWrap: { position: 'relative', marginBottom: 20 },
  aiBtn: {
    position: 'absolute', right: 8, top: 8,
    backgroundColor: '#EEF2FF', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#C7D2FE',
  },
  aiBtnText: { fontSize: 12, fontWeight: '700', color: '#6366F1' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.gray200,
  },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: '500', color: COLORS.gray600 },
  chipTextSelected: { color: COLORS.white },
  btn: {
    height: 54, borderRadius: 16, justifyContent: 'center',
    alignItems: 'center', marginTop: 8,
  },
  btnText: { fontSize: 16, fontWeight: '700' },
  logoUpload: {
    width: 100, height: 100, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed',
    borderColor: COLORS.gray300, backgroundColor: COLORS.white, overflow: 'hidden',
    marginBottom: 24, justifyContent: 'center', alignItems: 'center',
  },
  logoImage: { width: '100%', height: '100%' },
  logoPlaceholder: { alignItems: 'center' },
  logoPlaceholderIcon: { fontSize: 28, marginBottom: 4 },
  logoPlaceholderText: { fontSize: 11, color: COLORS.gray400 },
  skipBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
  skipText: { fontSize: 14, color: COLORS.gray400, textDecorationLine: 'underline' },
  deliveryCard: {
    backgroundColor: '#F3E8FF', borderRadius: 16, padding: 16,
    marginBottom: 24, borderWidth: 1, borderColor: '#E9D5FF',
  },
  deliveryTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray900, marginBottom: 12 },
  checkboxRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: COLORS.gray300, backgroundColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary, borderColor: COLORS.primary,
  },
  checkmark: { color: COLORS.white, fontSize: 14, fontWeight: '700', marginTop: -1 },
  checkboxLabel: { fontSize: 14, color: COLORS.gray600, fontWeight: '500' },
  radiusContainer: { position: 'relative', marginBottom: 20 },
  radiusInput: { paddingRight: 140 },
  radiusLabel: { position: 'absolute', right: 16, top: 16, fontSize: 13, color: COLORS.gray500, fontWeight: '500' },
  bulkCard: {
    backgroundColor: '#F0F9FF', borderRadius: 16, padding: 20,
    alignItems: 'center', marginBottom: 20, borderWidth: 1.5, borderColor: '#BFE7FF', borderStyle: 'dashed',
  },
  bulkIcon: { fontSize: 36, marginBottom: 8 },
  bulkTitle: { fontSize: 16, fontWeight: '700', color: COLORS.gray900, marginBottom: 4 },
  bulkDesc: { fontSize: 12, color: COLORS.gray500, marginBottom: 12, textAlign: 'center' },
  uploadBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12,
    marginBottom: 8,
  },
  uploadBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14, textAlign: 'center' },
  csvHint: { fontSize: 11, color: COLORS.gray400, fontStyle: 'italic', textAlign: 'center' },
  divider: { height: 1, backgroundColor: COLORS.gray200, marginVertical: 16 },
  dividerText: { textAlign: 'center', color: COLORS.gray400, fontSize: 12, fontWeight: '600', marginVertical: -8 },
  quickAddCard: {
    backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.gray200,
  },
  quickAddTitle: { fontSize: 14, fontWeight: '700', color: COLORS.gray900, marginBottom: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: 350,
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray100,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.gray900,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  timeSlot: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  timeSlotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeSlotLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray700,
  },
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.gray500,
    marginBottom: 6,
  },
  timeInput: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gray200,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.gray900,
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 14,
    color: COLORS.gray400,
    fontWeight: '600',
    marginTop: 20,
  },
  addSlotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addSlotText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  modalSaveBtn: {
    margin: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
});
