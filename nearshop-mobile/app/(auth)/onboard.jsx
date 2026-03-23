import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Toast from 'react-native-toast-message';
import { completeProfile } from '../../lib/auth';
import { createShop } from '../../lib/shops';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { COLORS, SHADOWS } from '../../constants/theme';

const INTERESTS = [
  'Clothing & Fashion', 'Electronics', 'Grocery & Daily Needs',
  'Food & Bakery', 'Home & Kitchen', 'Beauty & Personal Care',
  'Books & Stationery', 'Sports & Fitness', 'Jewelry & Accessories', 'Toys & Games',
];

const SHOP_CATEGORIES = [
  'Electronics', 'Clothing', 'Grocery', 'Food', 'Home', 'Beauty', 'Other',
];

export default function OnboardScreen() {
  const { role } = useLocalSearchParams();
  const [name, setName] = useState('');
  const [interests, setInterests] = useState([]);
  const [shopName, setShopName] = useState('');
  const [shopCat, setShopCat] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { updateUser } = useAuthStore();
  const { lat, lng } = useLocationStore();

  const toggleInterest = (item) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleComplete = async () => {
    if (role === 'customer' && (!name.trim() || interests.length < 3)) {
      Toast.show({ type: 'error', text1: 'Add your name and pick at least 3 interests' });
      return;
    }
    if (role === 'business' && (!shopName.trim() || !shopCat)) {
      Toast.show({ type: 'error', text1: 'Enter shop name and pick a category' });
      return;
    }

    setLoading(true);
    try {
      const { data } = await completeProfile({
        name: role === 'customer' ? name.trim() : shopName.trim(),
        role,
        interests: role === 'customer' ? interests : [],
      });
      const user = data.user || data;
      await updateUser(user);

      if (role === 'business') {
        // latitude & longitude are required by the backend schema
        await createShop({
          name: shopName.trim(),
          category: shopCat,
          latitude: lat ?? 12.9352,   // fallback: Koramangala, Bangalore
          longitude: lng ?? 77.6245,
        });
      }

      Toast.show({
        type: 'success',
        text1: role === 'customer' ? '🎉 Welcome to NearShop!' : '🏪 Shop created!',
      });
      router.replace(role === 'business' ? '/(business)/dashboard' : '/(customer)/home');
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Setup failed',
        text2: err.response?.data?.detail || err.message,
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

  const canSubmit = role === 'customer'
    ? name.trim().length > 0 && interests.length >= 3
    : shopName.trim().length > 0 && shopCat.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Back button */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>
          {role === 'customer' ? 'Tell us about yourself' : 'Set up your shop'}
        </Text>
        <Text style={styles.subtitle}>
          {role === 'customer'
            ? 'Personalize your experience by sharing your interests'
            : 'Get online in under 2 minutes'}
        </Text>

        {role === 'customer' ? (
          <>
            <Text style={styles.label}>Your name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Priya Sharma"
              placeholderTextColor={COLORS.gray400}
              style={styles.input}
              autoCapitalize="words"
            />

            <Text style={styles.label}>
              What do you love? <Text style={styles.hint}>(pick 3+)</Text>
            </Text>
            <View style={styles.chips}>
              {INTERESTS.map((item) => (
                <Chip
                  key={item} label={item}
                  selected={interests.includes(item)}
                  onPress={() => toggleInterest(item)}
                />
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.label}>Shop name</Text>
            <TextInput
              value={shopName}
              onChangeText={setShopName}
              placeholder="e.g. Ramesh Electronics"
              placeholderTextColor={COLORS.gray400}
              style={styles.input}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Category</Text>
            <View style={styles.chips}>
              {SHOP_CATEGORIES.map((cat) => (
                <Chip
                  key={cat} label={cat}
                  selected={shopCat === cat}
                  onPress={() => setShopCat(cat)}
                />
              ))}
            </View>
          </>
        )}

        <TouchableOpacity
          onPress={handleComplete}
          disabled={loading || !canSubmit}
          activeOpacity={0.85}
          style={[styles.btn, { backgroundColor: canSubmit ? COLORS.primary : COLORS.gray200 }]}
        >
          <Text style={[styles.btnText, { color: canSubmit ? COLORS.white : COLORS.gray400 }]}>
            {loading
              ? 'Setting up…'
              : role === 'customer' ? 'Start Exploring 🎉' : 'Create My Shop 🏪'}
          </Text>
        </TouchableOpacity>
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
    borderColor: COLORS.gray200, marginBottom: 24,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 32 },
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
});
