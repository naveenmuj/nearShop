import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { updateProfile } from '../../lib/auth';
import useAuthStore from '../../store/authStore';
import { COLORS, SHADOWS } from '../../constants/theme';
import client from '../../lib/api';

const INTERESTS = [
  'Clothing & Fashion', 'Electronics', 'Grocery & Daily Needs',
  'Food & Bakery', 'Home & Kitchen', 'Beauty & Personal Care',
  'Books & Stationery', 'Sports & Fitness', 'Jewelry & Accessories',
];

function Chip({ label, selected, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function CustomerProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [interests, setInterests] = useState([]);
  const [avatarUri, setAvatarUri] = useState(user?.avatar_url || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const showPhone = !user?.phone; // only ask for phone if not already set

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled) return;
    if (!result.assets?.length) {
      Toast.show({ type: 'error', text1: 'No image selected' });
      return;
    }
    const asset = result.assets[0];

    // Upload to backend
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: 'image/jpeg',
        name: 'avatar.jpg',
      });
      formData.append('folder', 'avatars');
      const { data } = await client.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAvatarUri(data.url);
    } catch {
      Toast.show({ type: 'error', text1: 'Photo upload failed', text2: 'You can skip this and add later' });
    } finally {
      setUploading(false);
    }
  };

  const toggleInterest = (item) => {
    setInterests(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Please enter your name' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        interests,
        ...(avatarUri && avatarUri !== user?.avatar_url ? { avatar_url: avatarUri } : {}),
        ...(showPhone && phone.trim() ? { phone: phone.trim() } : {}),
      };
      const { data } = await updateProfile(payload);
      const updatedUser = data.user || data;
      await updateUser(updatedUser);
      Toast.show({ type: 'success', text1: '🎉 Profile set up!', text2: `Welcome, ${name.trim()}!` });
      router.replace('/(customer)/home');
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Could not save profile', text2: err?.response?.data?.detail || err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    router.replace('/(customer)/home');
  };

  const initials = name.trim() ? name.trim()[0].toUpperCase() : '?';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.headerRow}>
          <View />
          <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={styles.heroGradient}>
            <Text style={styles.heroEmoji}>👋</Text>
          </View>
          <Text style={styles.heroTitle}>Welcome to NearShop!</Text>
          <Text style={styles.heroSub}>Tell us a bit about yourself so we can personalise your experience.</Text>
        </View>

        {/* Avatar picker */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickPhoto} activeOpacity={0.8} style={styles.avatarBtn} disabled={uploading}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{initials}</Text>
              </View>
            )}
            <View style={styles.avatarOverlay}>
              {uploading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={{ fontSize: 16 }}>📷</Text>
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Tap to add a photo (optional)</Text>
        </View>

        {/* Name */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Your name <Text style={styles.required}>*</Text></Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Priya Sharma"
            placeholderTextColor={COLORS.gray400}
            autoCapitalize="words"
            style={styles.input}
          />
        </View>

        {/* Phone (only if not set) */}
        {showPhone && (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Phone number <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              placeholderTextColor={COLORS.gray400}
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>
        )}

        {/* Interests */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>What do you love? <Text style={styles.optional}>(optional)</Text></Text>
          <View style={styles.chips}>
            {INTERESTS.map(item => (
              <Chip key={item} label={item} selected={interests.includes(item)} onPress={() => toggleInterest(item)} />
            ))}
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || uploading || !name.trim()}
          style={[styles.saveBtn, (!name.trim() || saving) && styles.saveBtnDisabled]}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Start Shopping 🛍️</Text>
          )}
        </TouchableOpacity>

        {/* Also register business */}
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/(auth)/onboard', params: { role: 'business' } })}
          style={styles.bizLink}
        >
          <Text style={styles.bizLinkText}>🏪 I also own a business — register it</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  skipBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  skipText: { fontSize: 14, color: COLORS.gray400, fontWeight: '500' },

  heroSection: { alignItems: 'center', paddingVertical: 20 },
  heroGradient: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  heroEmoji: { fontSize: 40 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: COLORS.gray900, textAlign: 'center' },
  heroSub: { fontSize: 14, color: COLORS.gray500, textAlign: 'center', lineHeight: 20, marginTop: 8, maxWidth: 300 },

  avatarSection: { alignItems: 'center', marginVertical: 20 },
  avatarBtn: { position: 'relative' },
  avatarImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.primary },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: COLORS.primaryLight,
  },
  avatarInitial: { fontSize: 36, fontWeight: '800', color: '#fff' },
  avatarOverlay: {
    position: 'absolute', bottom: 0, right: 0,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.gray800, borderWidth: 2, borderColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarHint: { fontSize: 12, color: COLORS.gray400, marginTop: 8 },

  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.gray700, marginBottom: 10 },
  required: { color: COLORS.red },
  optional: { color: COLORS.gray400, fontWeight: '400' },
  input: {
    height: 52, paddingHorizontal: 16, fontSize: 16, color: COLORS.gray900,
    backgroundColor: COLORS.white, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.gray200, ...SHADOWS.card,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.gray200,
  },
  chipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '500', color: COLORS.gray600 },
  chipTextSelected: { color: '#fff' },

  saveBtn: {
    height: 54, borderRadius: 16, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
    ...SHADOWS.cardHover,
  },
  saveBtnDisabled: { backgroundColor: COLORS.gray200 },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  bizLink: { alignItems: 'center', marginTop: 16, paddingVertical: 10 },
  bizLinkText: { fontSize: 13, color: COLORS.primary, fontWeight: '600', textDecorationLine: 'underline' },
});
