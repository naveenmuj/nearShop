import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import useMyShop from '../../hooks/useMyShop';
import client from '../../lib/api';
import { COLORS, SHADOWS } from '../../constants/theme';

const CATEGORIES = [
  'Grocery', 'Bakery', 'Dairy', 'Snacks', 'Beverages',
  'Fruits', 'Vegetables', 'Household', 'Personal Care', 'Other',
];

const STEPS = ['capture', 'analyzing', 'review'];
const STEP_LABELS = ['Capture', 'Analyzing', 'Review'];

export default function SnapListScreen() {
  const { shopId, loading: shopLoading } = useMyShop();
  const [step, setStep] = useState('capture');
  const [imageUri, setImageUri] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [aiFailed, setAiFailed] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');

  // Animated dots for analyzing step
  const [dots, setDots] = useState('.');
  const dotsRef = useRef(null);

  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (step === 'analyzing') {
      dotsRef.current = setInterval(() => {
        setDots((d) => (d === '...' ? '.' : d + '.'));
      }, 500);
    } else {
      if (dotsRef.current) clearInterval(dotsRef.current);
    }
    return () => {
      if (dotsRef.current) clearInterval(dotsRef.current);
    };
  }, [step]);

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      handleImagePicked(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      handleImagePicked(result.assets[0].uri);
    }
  };

  // ── Upload image to server and get back a URL ────────────────────────────
  const uploadImage = async (uri) => {
    const formData = new FormData();
    formData.append('file', {
      uri,
      type: 'image/jpeg',
      name: 'product.jpg',
    });
    const res = await client.post('/upload?folder=products', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
    const url = res?.data?.url || res?.data?.file_url;
    if (!url) throw new Error('Upload succeeded but no URL returned');
    return url;
  };

  // ── AI analysis using the backend endpoint ───────────────────────────────
  const handleImagePicked = async (uri) => {
    setImageUri(uri);
    setStep('analyzing');
    setAiFailed(false);
    try {
      const formData = new FormData();
      formData.append('image', {
        uri,
        type: 'image/jpeg',
        name: 'product.jpg',
      });
      // Use the axios client which has base URL + auth token
      const response = await client.post('/ai/catalog/snap', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
      const data = response.data;
      if (data.error || data.fallback) {
        throw new Error('AI returned fallback');
      }
      setAiResult(data);
      setName(data.name || '');
      // Handle estimated_price_range from AI
      if (data.estimated_price_range) {
        const avg = Math.round((data.estimated_price_range.min + data.estimated_price_range.max) / 2);
        setPrice(String(avg));
      } else if (data.price) {
        setPrice(String(data.price));
      }
      setDescription(data.description || '');
      setCategory(data.category || '');
    } catch {
      setAiFailed(true);
      setName('');
      setPrice('');
      setDescription('');
      setCategory('');
    } finally {
      setStep('review');
    }
  };

  // ── Publish product ──────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Product name is required');
      return;
    }
    if (!price || isNaN(Number(price)) || Number(price) < 0) {
      Alert.alert('Validation', 'Please enter a valid price');
      return;
    }
    if (!shopId) {
      Alert.alert('Error', 'No shop found. Please create a shop first.');
      return;
    }

    setPublishing(true);
    try {
      // Step 1: Upload the image to get a public URL
      let imageUrl = null;
      if (imageUri) {
        try {
          imageUrl = await uploadImage(imageUri);
        } catch {
          // Image upload failed — create product without image
        }
      }

      // Step 2: Create product with proper schema
      const productData = {
        name: name.trim(),
        price: Number(price),
        description: description.trim() || undefined,
        category: category || undefined,
        images: imageUrl ? [imageUrl] : [],
      };

      await client.post(`/products?shop_id=${shopId}`, productData);

      Alert.alert('Success', 'Product published!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : 'Failed to publish product. Please try again.';
      Alert.alert('Error', msg);
    } finally {
      setPublishing(false);
    }
  };

  const stepIndex = STEPS.indexOf(step);

  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      {/* Step Indicator */}
      <View style={styles.stepBar}>
        {STEP_LABELS.map((label, i) => (
          <React.Fragment key={label}>
            <View style={styles.stepItem}>
              <View style={[styles.stepDot, i <= stepIndex && styles.stepDotActive]}>
                <Text style={[styles.stepDotText, i <= stepIndex && styles.stepDotTextActive]}>
                  {i + 1}
                </Text>
              </View>
              <Text style={[styles.stepLabel, i <= stepIndex && styles.stepLabelActive]}>
                {label}
              </Text>
            </View>
            {i < STEP_LABELS.length - 1 && (
              <View style={[styles.stepLine, i < stepIndex && styles.stepLineActive]} />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* STEP 1: Capture */}
      {step === 'capture' && (
        <ScrollView contentContainerStyle={styles.captureContainer}>
          <Text style={styles.captureTitle}>Snap & List</Text>
          <Text style={styles.captureSubtitle}>AI will auto-fill product details</Text>

          <TouchableOpacity style={styles.cameraCard} onPress={pickFromCamera} activeOpacity={0.8}>
            <Ionicons name="camera" size={48} color={COLORS.gray300} />
            <Text style={styles.cameraCardText}>Tap to capture product photo</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.galleryLink} onPress={pickFromGallery}>
            <Ionicons name="images-outline" size={18} color={COLORS.primary} />
            <Text style={styles.galleryLinkText}>Choose from gallery</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* STEP 2: Analyzing */}
      {step === 'analyzing' && (
        <View style={styles.analyzingContainer}>
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.analyzingImage} resizeMode="cover" />
          )}
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 32 }} />
          <Text style={styles.analyzingText}>AI is analyzing your product{dots}</Text>
        </View>
      )}

      {/* STEP 3: Review */}
      {step === 'review' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.reviewContainer} showsVerticalScrollIndicator={false}>
            {aiFailed && (
              <View style={styles.aiBanner}>
                <Ionicons name="warning-outline" size={16} color={COLORS.amber} />
                <Text style={styles.aiBannerText}>AI unavailable — fill manually</Text>
              </View>
            )}

            {/* Image preview */}
            {imageUri && (
              <Image source={{ uri: imageUri }} style={styles.reviewImage} resizeMode="cover" />
            )}

            {/* Confidence badge */}
            {aiResult?.confidence && !aiFailed && (
              <View style={styles.confidenceBadge}>
                <Ionicons name="sparkles" size={14} color={COLORS.green} />
                <Text style={styles.confidenceText}>{Math.round(aiResult.confidence * 100)}% confident</Text>
              </View>
            )}

            {/* Form Fields */}
            <Text style={styles.fieldLabel}>Product Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Fresh Mango"
              placeholderTextColor={COLORS.gray400}
            />

            <Text style={styles.fieldLabel}>Price (₹)</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="0"
              placeholderTextColor={COLORS.gray400}
              keyboardType="numeric"
            />

            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your product..."
              placeholderTextColor={COLORS.gray400}
              multiline
              numberOfLines={3}
            />

            {/* Category Chips */}
            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Shop status */}
            {shopLoading && (
              <Text style={styles.shopStatus}>Loading shop...</Text>
            )}
            {!shopLoading && !shopId && (
              <Text style={styles.shopStatusError}>No shop found. Please create a shop first.</Text>
            )}

            {/* Action Buttons */}
            <TouchableOpacity
              style={[styles.publishBtn, (publishing || !shopId) && { opacity: 0.7 }]}
              onPress={handlePublish}
              disabled={publishing || !shopId}
            >
              {publishing ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.publishBtnText}>Publish</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.retakeBtn}
              onPress={() => setStep('capture')}
              disabled={publishing}
            >
              <Text style={styles.retakeBtnText}>Retake</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  stepBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, paddingVertical: 16,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.gray100,
  },
  stepItem: { alignItems: 'center' },
  stepDot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.gray100,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  stepDotActive: { backgroundColor: COLORS.primary },
  stepDotText: { fontSize: 13, fontWeight: '700', color: COLORS.gray400 },
  stepDotTextActive: { color: COLORS.white },
  stepLabel: { fontSize: 11, color: COLORS.gray400, fontWeight: '500' },
  stepLabelActive: { color: COLORS.primary, fontWeight: '700' },
  stepLine: { flex: 1, height: 2, backgroundColor: COLORS.gray200, marginHorizontal: 6, marginBottom: 16 },
  stepLineActive: { backgroundColor: COLORS.primary },
  captureContainer: { flex: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 32 },
  captureTitle: { fontSize: 24, fontWeight: '800', color: COLORS.gray900, marginBottom: 6 },
  captureSubtitle: { fontSize: 15, color: COLORS.gray500, marginBottom: 32 },
  cameraCard: {
    width: '100%', height: 200, borderRadius: 16, backgroundColor: COLORS.white,
    borderWidth: 2, borderColor: COLORS.gray200, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 12, ...SHADOWS.card,
  },
  cameraCardText: { fontSize: 15, color: COLORS.gray400, fontWeight: '500' },
  galleryLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, padding: 10 },
  galleryLinkText: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  analyzingContainer: { flex: 1, alignItems: 'center', paddingTop: 24 },
  analyzingImage: { width: '100%', height: 250 },
  analyzingText: { fontSize: 16, fontWeight: '600', color: COLORS.gray700, marginTop: 16 },
  reviewContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  aiBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.amberLight, borderRadius: 8, padding: 10, marginBottom: 14,
  },
  aiBannerText: { fontSize: 14, color: COLORS.amber, fontWeight: '600' },
  reviewImage: { width: '100%', height: 100, borderRadius: 10, marginBottom: 12 },
  confidenceBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.greenLight,
    alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, marginBottom: 16,
  },
  confidenceText: { fontSize: 13, fontWeight: '700', color: COLORS.green },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: COLORS.gray600, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: COLORS.white, borderRadius: 10, borderWidth: 1, borderColor: COLORS.gray200,
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: COLORS.gray900,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top', paddingTop: 11 },
  categoryScroll: { flexGrow: 0, marginTop: 2 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: COLORS.white,
    borderWidth: 1, borderColor: COLORS.gray200, marginRight: 8, marginBottom: 4,
  },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryChipText: { fontSize: 13, fontWeight: '500', color: COLORS.gray600 },
  categoryChipTextActive: { color: COLORS.white, fontWeight: '700' },
  shopStatus: { fontSize: 13, color: COLORS.gray400, textAlign: 'center', marginTop: 16 },
  shopStatusError: { fontSize: 13, color: COLORS.red, textAlign: 'center', marginTop: 16 },
  publishBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24,
  },
  publishBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
  retakeBtn: {
    borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 10,
    borderWidth: 1.5, borderColor: COLORS.primary,
  },
  retakeBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 16 },
});
